import type { Member } from "./db.js";

// Deliberately "hostile legacy" markup: frameset navigation, table-based
// layout, ASP.NET-WebForms-style auto-generated ids, no test ids, no
// semantic tags, full-page postbacks. This is the surface the discovery
// agent and the replay engine both have to cope with.

const PAGE_HEAD = `<meta charset="utf-8"><title>LegacyCore Banking Platform</title>`;

export function frameset(): string {
  return `<html><head>${PAGE_HEAD}</head>
<frameset rows="70,*" border="1">
  <frame src="/nav" name="navFrame" scrolling="no">
  <frame src="/home" name="mainFrame">
</frameset>
</html>`;
}

export function nav(): string {
  return `<html><head>${PAGE_HEAD}</head>
<body bgcolor="#003366">
<table width="100%" cellpadding="4" cellspacing="0" border="0">
  <tr>
    <td><font color="white" size="4"><b>LegacyCore Banking Platform v3.2</b></font></td>
    <td align="right">
      <a href="/members/search" target="mainFrame"><font color="white">Member Lookup</font></a>
      &nbsp;|&nbsp;
      <a href="/home" target="mainFrame"><font color="white">Home</font></a>
      &nbsp;|&nbsp;
      <a href="/login" target="_top"><font color="white">Log Off</font></a>
    </td>
  </tr>
</table>
</body></html>`;
}

export function loginForm(error?: string): string {
  return `<html><head>${PAGE_HEAD}</head>
<body>
<table align="center" cellpadding="8"><tr><td>
<h2>LegacyCore Banking Platform</h2>
${error ? `<p><font color="red">${error}</font></p>` : ""}
<form id="ctl00_frmLogin" method="post" action="/login">
  <table cellpadding="4">
    <tr><td>Operator ID:</td><td><input type="text" id="ctl00_txtOperatorId" name="operatorId" /></td></tr>
    <tr><td colspan="2" align="center">
      <input type="submit" id="ctl00_btnLogin" name="btnLogin" value="Log In" />
    </td></tr>
  </table>
</form>
</td></tr></table>
</body></html>`;
}

export function sessionExpired(): string {
  return `<html><head>${PAGE_HEAD}</head>
<body>
<h3>Your session has expired.</h3>
<p>Please <a href="/login" target="_top">log in</a> again to continue.</p>
</body></html>`;
}

export function home(operatorId: string): string {
  return `<html><head>${PAGE_HEAD}</head>
<body>
<p>Welcome, operator <b>${escapeHtml(operatorId)}</b>.</p>
<p>Use the navigation bar above to look up a member.</p>
</body></html>`;
}

export function memberSearchForm(): string {
  return `<html><head>${PAGE_HEAD}</head>
<body>
<h3>Member Lookup</h3>
<form id="ctl00_ContentPlaceHolder1_frmSearch" method="get" action="/members/lookup">
  <table cellpadding="4">
    <tr>
      <td>Member ID:</td>
      <td><input type="text" id="ctl00_ContentPlaceHolder1_txtMemberId" name="memberId" /></td>
      <td><input type="submit" id="ctl00_ContentPlaceHolder1_btnSearch" name="btnSearch" value="Search" /></td>
    </tr>
  </table>
</form>
</body></html>`;
}

export function memberNotFound(memberId: string): string {
  return outcomePage(`No member found matching ID ${escapeHtml(memberId)}.`, "NOT_FOUND");
}

export function permissionDenied(memberId: string): string {
  return outcomePage(
    `You are not authorized to view record ${escapeHtml(memberId)}.`,
    "PERMISSION_DENIED",
  );
}

function outcomePage(message: string, code: string): string {
  return `<html><head>${PAGE_HEAD}</head>
<body>
<table><tr><td>
<p><b>${escapeHtml(message)}</b></p>
<!-- outcome-code: ${code} -->
<p><a href="/members/search" target="_self">Back to search</a></p>
</td></tr></table>
</body></html>`;
}

export function memberDetail(member: Member): string {
  return `<html><head>${PAGE_HEAD}</head>
<body>
<h3>Member Detail</h3>
<table id="ctl00_ContentPlaceHolder1_gvMember" border="1" cellpadding="4">
  <tr><td>Member ID</td><td id="ctl00_ContentPlaceHolder1_gvMember_ctl02_lblId">${escapeHtml(member.id)}</td></tr>
  <tr><td>Name</td><td id="ctl00_ContentPlaceHolder1_gvMember_ctl02_lblName">${escapeHtml(member.name)}</td></tr>
  <tr><td>Status</td><td id="ctl00_ContentPlaceHolder1_gvMember_ctl02_lblStatus">${escapeHtml(member.status)}</td></tr>
  <tr><td>Savings Balance</td><td id="ctl00_ContentPlaceHolder1_gvMember_ctl02_lblBalance">$${member.savingsBalance.toFixed(2)}</td></tr>
</table>
<p><a id="ctl00_ContentPlaceHolder1_lnkOpenSubAccount" href="/subaccounts/new?memberId=${encodeURIComponent(member.id)}">Open Sub-Account for this member</a></p>
</body></html>`;
}

export function subAccountForm(memberId: string): string {
  return `<html><head>${PAGE_HEAD}</head>
<body>
<h3>Open Sub-Account &mdash; Member ${escapeHtml(memberId)}</h3>
<form id="ctl00_ContentPlaceHolder1_frmNewSubAccount" method="post" action="/subaccounts/review">
  <input type="hidden" name="memberId" value="${escapeHtml(memberId)}" />
  <table cellpadding="4">
    <tr><td>Sub-Account Type:</td><td>
      <select id="ctl00_ContentPlaceHolder1_ddlType" name="type">
        <option value="MONEY_MARKET">Money Market</option>
        <option value="CD">Certificate of Deposit</option>
        <option value="CHECKING">Checking</option>
      </select>
    </td></tr>
    <tr><td>Initial Deposit ($):</td><td><input type="text" id="ctl00_ContentPlaceHolder1_txtDeposit" name="deposit" /></td></tr>
    <tr><td colspan="2" align="center">
      <input type="submit" id="ctl00_ContentPlaceHolder1_btnContinue" name="btnContinue" value="Continue" />
    </td></tr>
  </table>
</form>
</body></html>`;
}

export function subAccountValidationError(message: string, memberId: string): string {
  return `<html><head>${PAGE_HEAD}</head>
<body>
<p><font color="red"><b>${escapeHtml(message)}</b></font></p>
<!-- outcome-code: VALIDATION_ERROR -->
<p><a href="/subaccounts/new?memberId=${encodeURIComponent(memberId)}">Back</a></p>
</body></html>`;
}

export function subAccountReview(memberId: string, type: string, deposit: number): string {
  return `<html><head>${PAGE_HEAD}</head>
<body>
<h3>Confirm Sub-Account</h3>
<p>Open a <b>${escapeHtml(type)}</b> sub-account for member <b>${escapeHtml(memberId)}</b> with an initial deposit of <b>$${deposit.toFixed(2)}</b>?</p>
<form id="ctl00_ContentPlaceHolder1_frmConfirm" method="post" action="/subaccounts/confirm">
  <input type="hidden" name="memberId" value="${escapeHtml(memberId)}" />
  <input type="hidden" name="type" value="${escapeHtml(type)}" />
  <input type="hidden" name="deposit" value="${deposit}" />
  <input type="submit" id="ctl00_ContentPlaceHolder1_btnConfirm" name="btnConfirm" value="Confirm" />
</form>
<form id="ctl00_ContentPlaceHolder1_frmCancel" method="get" action="/subaccounts/new">
  <input type="hidden" name="memberId" value="${escapeHtml(memberId)}" />
  <input type="submit" id="ctl00_ContentPlaceHolder1_btnCancel" name="btnCancel" value="Cancel" />
</form>
</body></html>`;
}

export function subAccountSuccess(memberId: string, subAccountId: string): string {
  return `<html><head>${PAGE_HEAD}</head>
<body>
<p><b>Sub-Account ${escapeHtml(subAccountId)} opened successfully for Member ${escapeHtml(memberId)}.</b></p>
<!-- outcome-code: SUCCESS -->
<p id="ctl00_ContentPlaceHolder1_lblNewSubAccountId">${escapeHtml(subAccountId)}</p>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
