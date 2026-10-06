/**
 * Dashboard Logic - Fetches and renders live library statistics
 */

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();
});

async function loadDashboardData() {
  try {
    const stats = await fetchAPI("/api/dashboard/stats");

    // 1. Metric Cards
    document.getElementById("stat-total-books").textContent = stats.total_books ?? 0;
    document.getElementById("stat-total-copies").textContent = `${stats.total_copies ?? 0} total copies`;
    document.getElementById("stat-available-books").textContent = stats.available_books ?? 0;
    document.getElementById("stat-issued-books").textContent = stats.issued_books ?? 0;
    document.getElementById("stat-total-members").textContent = stats.total_members ?? 0;
    document.getElementById("stat-overdue-books").textContent = stats.overdue_books ?? 0;
    document.getElementById("stat-total-fines").textContent = formatCurrency(stats.total_fine);

    // 2. Recent Transactions
    renderRecentTransactions(stats.recent_transactions || []);

    // 3. Category Distribution
    renderCategoryDistribution(stats.category_distribution || {});
  } catch (err) {
    showToast("Failed to load dashboard data: " + err.message, "error");
  }
}

function renderRecentTransactions(transactions) {
  const tbody = document.getElementById("recent-transactions-table-body");
  if (!tbody) return;

  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">📂</div>
          <h3>No transactions recorded yet</h3>
          <p>Circulation activity will appear here once books are issued.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions.map(tx => {
    let badgeClass = "badge-issued";
    if (tx.status === "Returned") badgeClass = "badge-returned";
    else if (tx.status === "Overdue") badgeClass = "badge-overdue";

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
        <td>${formatDate(tx.due_date)}</td>
        <td>
          <span class="badge ${badgeClass}">${tx.status}</span>
        </td>
        <td>
          ${tx.fine > 0 ? `<strong style="color: var(--danger);">${formatCurrency(tx.fine)}</strong>` : `<span style="color: var(--text-muted);">₹0</span>`}
        </td>
      </tr>
    `;
  }).join("");
}

function renderCategoryDistribution(categories) {
  const container = document.getElementById("category-distribution-list");
  if (!container) return;

  const entries = Object.entries(categories);
  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No books cataloged yet.</p>
      </div>
    `;
    return;
  }

  const totalCopies = entries.reduce((acc, [, count]) => acc + count, 0);

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      ${entries.map(([cat, count]) => {
        const pct = totalCopies > 0 ? Math.round((count / totalCopies) * 100) : 0;
        return `
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 5px;">
              <span>${escapeHTML(cat)}</span>
              <span style="color: var(--text-muted);">${count} copies (${pct}%)</span>
            </div>
            <div style="width: 100%; height: 8px; background-color: var(--border-color); border-radius: 4px; overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary)); border-radius: 4px;"></div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
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
