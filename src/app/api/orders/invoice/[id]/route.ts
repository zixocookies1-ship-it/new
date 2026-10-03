import { findOrderForCustomer } from '@/lib/orders';
import { getBusinessSettings } from '@/lib/models/BusinessSettings';
import { getShippingConfig } from '@/lib/models/ShippingConfiguration';
import { rateLimited, noStore } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';
import { orderIdParamSchema } from '@/lib/validation';
import { formatINR } from '@/lib/money';
import { escapeHtml } from '@/lib/html';
import { humanStatus } from '@/lib/order-view';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tax invoice for a real order.
 *
 * Security: the URL carries an order ID, which is guessable, so the contact
 * value (email or mobile on the order) is required as well — the identical bar
 * used by `/api/track` and `/api/orders/cancel`. A wrong contact returns the
 * same 404 as an unknown order, so this endpoint cannot be used to confirm that
 * an order exists.
 *
 * Honesty: an invoice is only produced once payment is actually confirmed (or
 * the order is cash-on-delivery, which is confirmed the moment it is placed).
 * Every line and every amount is read from the persisted order — there is no
 * template document and nothing is invented.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('order:invoice', RATE_LIMITS.track.limit, RATE_LIMITS.track.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const url = new URL(req.url);
    const contact = (url.searchParams.get('contact') ?? '').trim();

    const parsed = orderIdParamSchema.safeParse({
      orderId: (await ctx.params).id,
    });
    if (!parsed.success) {
      return new Response('Order ID not recognised.', { status: 400, headers: noStore });
    }

    const order = await findOrderForCustomer(parsed.data.orderId, contact);
    if (!order) {
      return new Response(
        'We could not find an invoice for that order. Open your order page to confirm it is yours and download the invoice again.',
        { status: 404, headers: noStore },
      );
    }

    // Only a genuinely confirmed order gets an invoice. A pending Razorpay
    // payment does not — otherwise we would be issuing a document for money
    // that has not arrived.
    const confirmed =
      order.payment.status === 'PAID' ||
      (order.payment.method === 'COD' && order.status !== 'CANCELLED');
    if (!confirmed) {
      return new Response(
        'This order is not confirmed yet, so no invoice can be issued. Complete the payment and try again.',
        { status: 409, headers: noStore },
      );
    }

    const settings = await getBusinessSettings();
    const shipping = await getShippingConfig();

    const brand = settings.brandName || "Nature's Choice Jaggery";
    const sellerName = settings.legalName || brand;
    const invoiceNumber = `${order.orderId}`;
    const invoiceDate = new Date(order.createdAt);
    const orderDate = new Date(order.createdAt);

    const sellerLines = [
      shipping.pickupName || sellerName,
      [shipping.pickupAddressLine1, shipping.pickupAddressLine2].filter(Boolean).join(', '),
      [shipping.pickupCity, shipping.pickupState, shipping.pickupPincode]
        .filter(Boolean)
        .join(', '),
      settings.supportEmail,
      settings.supportPhone,
    ].filter((l) => l && String(l).trim().length > 0);

    const buyerLines = [
      order.shippingAddress.name,
      order.shippingAddress.line1,
      order.shippingAddress.line2,
      order.shippingAddress.landmark,
      [order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.pincode]
        .filter(Boolean)
        .join(', '),
      order.email ? `Email: ${order.email}` : '',
      `Phone: ${order.shippingAddress.phone}`,
    ].filter((l) => l && String(l).trim().length > 0);

    const rows = order.items
      .map(
        (item, index) => `
          <tr>
            <td class="num">${index + 1}</td>
            <td>
              <div class="strong">${escapeHtml(item.name)}</div>
              <div class="muted">${escapeHtml(item.weightLabel)}${
                item.bundleName ? ` · in ${escapeHtml(item.bundleName)}` : ''
              }</div>
              ${item.sku ? `<div class="muted">SKU ${escapeHtml(item.sku)}</div>` : ''}
            </td>
            <td class="num">${item.qty}</td>
            <td class="num">${formatINR(item.unitPricePaise)}</td>
            <td class="num strong">${formatINR(item.lineTotalPaise)}</td>
          </tr>`,
      )
      .join('');

    const totalQty = order.items.reduce((s, i) => s + i.qty, 0);

    const moneyRows = [
      { label: 'Subtotal', value: formatINR(order.subtotalPaise) },
      order.discountPaise > 0
        ? { label: 'Product savings', value: `-${formatINR(order.discountPaise)}` }
        : null,
      (order.couponDiscountPaise ?? 0) > 0
        ? {
            label: `Coupon discount${order.couponCode ? ` (${order.couponCode})` : ''}`,
            value: `-${formatINR(order.couponDiscountPaise ?? 0)}`,
          }
        : null,
      {
        label: 'Delivery',
        value:
          order.shippingChargedPaise > 0
            ? formatINR(order.shippingChargedPaise)
            : 'Free',
      },
      order.taxPaise > 0
        ? { label: `Tax (${shipping.taxInclusive ? 'inclusive' : 'added'})`, value: formatINR(order.taxPaise) }
        : null,
    ].filter((r): r is { label: string; value: string } => r !== null);

    const paidPaise = order.payment.status === 'PAID' ? order.totalPaise : 0;

    const paymentLine =
      order.payment.method === 'COD'
        ? `Cash on delivery — ${order.payment.status === 'PAID' ? 'collected' : 'due on delivery'}`
        : order.payment.status === 'PAID'
          ? 'Paid online'
          : humanStatus(order.payment.status);

    const meta = [
      ['Order ID', order.orderId],
      order.reference ? ['Reference', order.reference] : null,
      ['Order placed', orderDate.toLocaleString('en-IN')],
      ['Payment method', paymentLine],
      order.payment.razorpayPaymentId ? ['Payment reference', order.payment.razorpayPaymentId] : null,
      order.payment.razorpayOrderId ? ['Gateway order', order.payment.razorpayOrderId] : null,
      order.shipping.waybill ? ['Courier', `${order.shipping.carrier} · ${order.shipping.waybill}`] : null,
      ['Order status', humanStatus(order.status)],
    ].filter((r): r is [string, string] => r !== null);

    const registrations = [
      settings.gstNumber ? ['GSTIN', settings.gstNumber] : null,
      settings.fssaiNumber ? ['FSSAI', settings.fssaiNumber] : null,
      settings.cinNumber ? ['CIN', settings.cinNumber] : null,
    ].filter((r): r is [string, string] => r !== null);

    const html = `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Invoice ${escapeHtml(invoiceNumber)} — ${escapeHtml(brand)}</title>
<style>
  :root { --ink:#2B2320; --muted:#6B5D57; --line:#E7DCC9; --brand:#7A4A21; }
  * { box-sizing:border-box; }
  body { margin:0; padding:24px; background:#F7F1E8; color:var(--ink);
    font:15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
  .sheet { max-width:820px; margin:0 auto; background:#fff; border:1px solid var(--line);
    border-radius:14px; padding:32px; }
  header { display:flex; flex-wrap:wrap; gap:20px; justify-content:space-between;
    align-items:flex-start; border-bottom:2px solid var(--line); padding-bottom:20px; }
  h1 { margin:0 0 4px; font-size:20px; color:var(--brand); }
  .muted { color:var(--muted); font-size:12px; }
  .strong { font-weight:600; }
  ul.lines { margin:6px 0 0; padding:0; list-style:none; }
  ul.lines li { font-size:13px; }
  .grid { display:grid; gap:24px; grid-template-columns:repeat(auto-fit, minmax(240px,1fr)); margin:24px 0; }
  .block h2 { margin:0 0 8px; font-size:11px; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); }
  .docno { text-align:right; }
  .docno .n { font-size:17px; font-weight:700; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  th, td { padding:9px 8px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; font-size:13px; }
  th { font-size:11px; letter-spacing:.07em; text-transform:uppercase; color:var(--muted); }
  td.num, th.num { text-align:right; white-space:nowrap; }
  tfoot td { border-bottom:none; padding:6px 8px; }
  tfoot tr.grand td { border-top:2px solid var(--ink); border-bottom:none; font-size:17px; font-weight:700; padding-top:12px; }
  .paid { color:#2F6B3A; font-weight:600; }
  dl { margin:0; display:grid; gap:4px; }
  dl div { display:flex; gap:10px; font-size:13px; }
  dl dt { min-width:150px; color:var(--muted); }
  dl dd { margin:0; font-weight:600; }
  footer { margin-top:28px; padding-top:16px; border-top:1px solid var(--line);
    font-size:12px; color:var(--muted); }
  .actions { max-width:820px; margin:0 auto 14px; display:flex; gap:10px; justify-content:flex-end; }
  button { font:inherit; font-weight:600; cursor:pointer; border-radius:10px; padding:10px 18px;
    border:1px solid var(--brand); background:var(--brand); color:#fff; }
  button.ghost { background:transparent; color:var(--brand); }
  @media print {
    body { background:#fff; padding:0; }
    .sheet { border:none; border-radius:0; padding:0; max-width:none; }
    .actions { display:none; }
  }
</style>
</head>
<body>
<div class="actions">
  <button type="button" onclick="window.print()">Print or save as PDF</button>
</div>
<main class="sheet">
  <header>
    <div>
      <h1>Tax Invoice</h1>
      <div class="strong">${escapeHtml(sellerName)}</div>
      <ul class="lines">${sellerLines
        .map((l) => `<li>${escapeHtml(String(l))}</li>`)
        .join('')}</ul>
      ${
        registrations.length
          ? `<div class="muted" style="margin-top:6px">${registrations
              .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`)
              .join(' &middot; ')}</div>`
          : ''
      }
    </div>
    <div class="docno">
      <div class="n">${escapeHtml(invoiceNumber)}</div>
      <div class="muted">Issued ${escapeHtml(invoiceDate.toLocaleDateString('en-IN'))}</div>
    </div>
  </header>

  <div class="grid">
    <div class="block">
      <h2>Billed &amp; delivered to</h2>
      <ul class="lines">${buyerLines
        .map((l) => `<li class="strong">${escapeHtml(String(l))}</li>`)
        .join('')}</ul>
    </div>
    <div class="block">
      <h2>Order</h2>
      <dl>${meta
        .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`)
        .join('')}</dl>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="num" style="width:36px">#</th>
        <th>Item</th>
        <th class="num" style="width:56px">Qty</th>
        <th class="num" style="width:110px">Rate</th>
        <th class="num" style="width:120px">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      ${moneyRows
        .map(
          (r) =>
            `<tr><td colspan="4">${escapeHtml(r.label)}</td><td class="num">${escapeHtml(r.value)}</td></tr>`,
        )
        .join('')}
      <tr class="grand">
        <td colspan="4">Total paid${paidPaise === 0 ? '' : ''}</td>
        <td class="num">${formatINR(order.totalPaise)}</td>
      </tr>
      ${
        paidPaise > 0 && order.totalPaise > paidPaise
          ? `<tr><td colspan="4">Amount already paid</td><td class="num paid">${formatINR(paidPaise)}</td></tr>
             <tr><td colspan="4">Balance due</td><td class="num strong">${formatINR(order.totalPaise - paidPaise)}</td></tr>`
          : ''
      }
    </tfoot>
  </table>

  <div class="muted" style="margin-top:8px">${totalQty} item${totalQty === 1 ? '' : 's'} on this invoice.</div>

  <footer>
    <div class="strong">Notes</div>
    <div>Goods once sold are not returnable. Any discrepancy must be reported within 48 hours of delivery.</div>
    ${
      settings.supportEmail
        ? `<div>Questions about this invoice? Write to <a href="mailto:${escapeHtml(settings.supportEmail)}">${escapeHtml(settings.supportEmail)}</a>.</div>`
        : ''
    }
    <div>This document was generated from order ${escapeHtml(order.orderId)} on ${escapeHtml(new Date().toLocaleString('en-IN'))}.</div>
  </footer>
</main>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...noStore,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="invoice-${order.orderId}.html"`,
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (err) {
    console.error('[invoice:error]', err);
    return new Response('We could not generate that invoice right now. Please try again.', {
      status: 500,
      headers: noStore,
    });
  }
}