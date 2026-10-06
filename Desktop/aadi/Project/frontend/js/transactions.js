/**
 * Transactions & Overdue Tracking JavaScript Logic
 */

let allTransactions = [];

document.addEventListener("DOMContentLoaded", () => {
  initTransactionsPage();
});

function initTransactionsPage() {
  const searchInput = document.getElementById("tx-search-input");
  const statusFilter = document.getElementById("tx-status-filter");
  const refreshBtn = document.getElementById("refresh-tx-btn");

  // Check URL parameters for preset filter
  const urlParams = new URLSearchParams(window.location.search);
  const filterParam = urlParams.get("filter");

  if (filterParam) {
    const capitalized = filterParam.charAt(0).toUpperCase() + filterParam.slice(1).toLowerCase();
    statusFilter.value = capitalized;

    if (capitalized === "Overdue") {
      document.getElementById("page-heading").textContent = "⚠️ Overdue Books Tracking";
      const navOverdue = document.getElementById("nav-overdue");
      const navTx = document.getElementById("nav-transactions");
      if (navOverdue && navTx) {
        navTx.classList.remove("active");
        navOverdue.classList.add("active");
      }
    }
  }

  let searchTimeout = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadTransactions, 250);
  });

  statusFilter.addEventListener("change", () => {
    // Update heading if overdue selected
    if (statusFilter.value === "Overdue") {
      document.getElementById("page-heading").textContent = "⚠️ Overdue Books Tracking";
    } else {
      document.getElementById("page-heading").textContent = "Circulation Transactions";
    }
    loadTransactions();
  });

  refreshBtn.addEventListener("click", loadTransactions);

  loadTransactions();
}

async function loadTransactions() {
  const search = document.getElementById("tx-search-input").value.trim();
  const status = document.getElementById("tx-status-filter").value;
  const tbody = document.getElementById("tx-table-body");
  const countBadge = document.getElementById("tx-count");
  const filterIndicator = document.getElementById("filter-indicator");

  let query = "/api/transactions?";
  if (search) query += `search=${encodeURIComponent(search)}&`;
  if (status && status !== "All") query += `status=${encodeURIComponent(status)}&`;

  try {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div class="empty-state-icon">⏳</div>
          <h3>Fetching transactions...</h3>
        </td>
      </tr>
    `;

    const txs = await fetchAPI(query);
    allTransactions = txs;
    countBadge.textContent = txs.length;

    if (status !== "All") {
      filterIndicator.textContent = `Showing ${status} records only`;
    } else {
      filterIndicator.textContent = "";
    }

    renderTransactionsTable(txs);
  } catch (err) {
    showToast("Error loading transactions: " + err.message, "error");
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Failed to load transactions</h3>
          <p>${escapeHTML(err.message)}</p>
        </td>
      </tr>
    `;
  }
}

function renderTransactionsTable(transactions) {
  const tbody = document.getElementById("tx-table-body");
  if (!tbody) return;

  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div class="empty-state-icon">📑</div>
          <h3>No transactions found</h3>
          <p>Try changing your filter settings or checkout a new book.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions.map(tx => {
    let badgeClass = "badge-issued";
    if (tx.status === "Returned") badgeClass = "badge-returned";
    else if (tx.status === "Overdue") badgeClass = "badge-overdue";

    const isReturned = tx.return_date !== null;

    return `
      <tr>
        <td><strong>#${tx.id}</strong></td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${escapeHTML(tx.book_title)}</div>
          <div style="font-size: 11.5px; color: var(--text-muted);">ISBN: ${escapeHTML(tx.book_isbn)}</div>
        </td>
        <td>
          <div style="font-weight: 500;">${escapeHTML(tx.member_name)}</div>
          <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHTML(tx.member_roll_number)}</div>
        </td>
        <td>${formatDate(tx.issue_date)}</td>
        <td>
          <span style="${tx.status === 'Overdue' ? 'color: var(--danger); font-weight: 700;' : ''}">
            ${formatDate(tx.due_date)}
          </span>
          ${tx.status === 'Overdue' ? `<div style="font-size: 11px; color: var(--danger);">${tx.overdue_days} days late</div>` : ''}
        </td>
        <td>
          ${isReturned ? formatDate(tx.return_date) : '<span style="color: var(--text-muted);">Active (Not Returned)</span>'}
        </td>
        <td>
          <span class="badge ${badgeClass}">${tx.status}</span>
        </td>
        <td>
          ${tx.fine > 0 ? `<strong style="color: var(--danger);">${formatCurrency(tx.fine)}</strong>` : '<span style="color: var(--text-muted);">₹0</span>'}
        </td>
        <td style="text-align: right;">
          ${!isReturned ? `
            <a href="return.html?tx_id=${tx.id}" class="btn btn-success btn-sm" title="Return Book">
              📥 Return
            </a>
          ` : `
            <span class="badge badge-returned" style="font-size: 11px;">Completed</span>
          `}
        </td>
      </tr>
    `;
  }).join("");
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
