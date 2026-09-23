/**
 * Return Book & Fine Settlement JavaScript Logic
 */

let activeTransactions = [];
let selectedTransaction = null;
const FINE_RATE = 5; // ₹5 per day

document.addEventListener("DOMContentLoaded", () => {
  initReturnDesk();
  loadActiveLoans();
});

function initReturnDesk() {
  const searchInput = document.getElementById("return-search-input");
  const returnDateInput = document.getElementById("actual-return-date");
  const confirmBtn = document.getElementById("confirm-return-btn");
  const returnAnotherBtn = document.getElementById("return-another-btn");

  let searchTimeout = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterActiveLoans, 250);
  });

  returnDateInput.addEventListener("change", recalculateFine);
  confirmBtn.addEventListener("click", handleConfirmReturn);

  returnAnotherBtn.addEventListener("click", () => {
    document.getElementById("return-success-box").style.display = "none";
    document.getElementById("return-details-panel").style.display = "none";
    document.getElementById("no-selection-placeholder").style.display = "block";
    selectedTransaction = null;
    loadActiveLoans();
  });
}

function formatDateForInput(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function loadActiveLoans() {
  const listContainer = document.getElementById("active-loans-list");
  
  try {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⏳</div>
        <h3>Loading active loans...</h3>
      </div>
    `;

    // Fetch all transactions and filter active (unreturned)
    const allTxs = await fetchAPI("/api/transactions");
    activeTransactions = allTxs.filter(tx => tx.return_date === null);

    renderActiveLoans(activeTransactions);

    // Check if tx_id was supplied via URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const preTxId = urlParams.get("tx_id");
    if (preTxId) {
      const target = activeTransactions.find(t => t.id === parseInt(preTxId, 10));
      if (target) {
        selectLoan(target);
      }
    }
  } catch (err) {
    showToast("Failed to load transactions: " + err.message, "error");
  }
}

function filterActiveLoans() {
  const term = document.getElementById("return-search-input").value.toLowerCase().trim();
  if (!term) {
    renderActiveLoans(activeTransactions);
    return;
  }

  const filtered = activeTransactions.filter(tx => {
    return (
      String(tx.id).includes(term) ||
      (tx.book_title && tx.book_title.toLowerCase().includes(term)) ||
      (tx.book_isbn && tx.book_isbn.toLowerCase().includes(term)) ||
      (tx.member_name && tx.member_name.toLowerCase().includes(term)) ||
      (tx.member_roll_number && tx.member_roll_number.toLowerCase().includes(term))
    );
  });

  renderActiveLoans(filtered);
}

function renderActiveLoans(loans) {
  const container = document.getElementById("active-loans-list");
  if (!container) return;

  if (loans.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <h3>No active loans found</h3>
        <p>All issued books have been returned or no matches for your search.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = loans.map(tx => {
    const isSelected = selectedTransaction && selectedTransaction.id === tx.id;
    const isOverdue = tx.status === "Overdue";

    return `
      <div onclick="selectLoanById(${tx.id})" style="
        padding: 14px;
        border: 1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'};
        background-color: ${isSelected ? 'var(--primary-light)' : 'var(--bg-card)'};
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: var(--transition);
      ">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <strong style="color: var(--text-main); font-size: 14px;">${escapeHTML(tx.book_title)}</strong>
          <span class="badge ${isOverdue ? 'badge-overdue' : 'badge-issued'}">${tx.status}</span>
        </div>
        <div style="font-size: 12.5px; color: var(--text-muted);">
          Patron: <strong>${escapeHTML(tx.member_name)}</strong> (${escapeHTML(tx.member_roll_number)})
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 6px; color: var(--text-light);">
          <span>Tx #${tx.id}</span>
          <span style="color: ${isOverdue ? 'var(--danger)' : 'inherit'}; font-weight: ${isOverdue ? '600' : '400'};">
            Due: ${formatDate(tx.due_date)} ${isOverdue ? `(${tx.overdue_days}d late)` : ''}
          </span>
        </div>
      </div>
    `;
  }).join("");
}

function selectLoanById(id) {
  const target = activeTransactions.find(t => t.id === id);
  if (target) {
    selectLoan(target);
  }
}

function selectLoan(tx) {
  selectedTransaction = tx;
  renderActiveLoans(activeTransactions);

  document.getElementById("no-selection-placeholder").style.display = "none";
  const panel = document.getElementById("return-details-panel");
  panel.style.display = "block";

  document.getElementById("calc-tx-id").textContent = `Transaction #${tx.id}`;
  document.getElementById("calc-book-title").textContent = tx.book_title;
  document.getElementById("calc-book-isbn").textContent = `ISBN: ${tx.book_isbn}`;
  document.getElementById("calc-member-name").textContent = tx.member_name;
  document.getElementById("calc-member-roll").textContent = tx.member_roll_number;
  document.getElementById("calc-issue-date").textContent = formatDate(tx.issue_date);
  document.getElementById("calc-due-date").textContent = formatDate(tx.due_date);

  const statusBadge = document.getElementById("calc-status-badge");
  statusBadge.textContent = tx.status;
  statusBadge.className = `badge ${tx.status === 'Overdue' ? 'badge-overdue' : 'badge-issued'}`;

  // Set today as actual return date
  const returnInput = document.getElementById("actual-return-date");
  returnInput.value = formatDateForInput(new Date());

  recalculateFine();
}

function recalculateFine() {
  if (!selectedTransaction) return;

  const returnDateVal = document.getElementById("actual-return-date").value;
  if (!returnDateVal) return;

  const returnDate = new Date(returnDateVal);
  const dueDate = new Date(selectedTransaction.due_date);

  // Clear time components for pure day diff
  returnDate.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const timeDiff = returnDate.getTime() - dueDate.getTime();
  const overdueDays = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
  const fine = overdueDays * FINE_RATE;

  const fineStatusElem = document.getElementById("calc-fine-status-text");
  const overdueExplElem = document.getElementById("calc-overdue-explanation");
  const fineAmountElem = document.getElementById("calc-fine-amount");
  const fineBox = document.getElementById("calc-fine-box");

  fineAmountElem.textContent = formatCurrency(fine);

  if (overdueDays > 0) {
    fineStatusElem.textContent = `⚠️ Overdue by ${overdueDays} Day(s)`;
    fineStatusElem.style.color = "#b91c1c";
    overdueExplElem.textContent = `${overdueDays} days late × ₹${FINE_RATE}/day fine rate`;
    fineBox.style.background = "linear-gradient(135deg, #fef2f2, #fee2e2)";
    fineBox.style.borderColor = "#fca5a5";
    fineAmountElem.style.color = "#b91c1c";
  } else {
    fineStatusElem.textContent = "✅ On-Time Return (No Fine)";
    fineStatusElem.style.color = "#047857";
    overdueExplElem.textContent = "Returned on or before due date";
    fineBox.style.background = "linear-gradient(135deg, #ecfdf5, #d1fae5)";
    fineBox.style.borderColor = "#6ee7b7";
    fineAmountElem.style.color = "#047857";
  }
}

async function handleConfirmReturn() {
  if (!selectedTransaction) {
    showToast("Please select a transaction first", "warning");
    return;
  }

  const return_date = document.getElementById("actual-return-date").value;
  if (!return_date) {
    showToast("Please specify the actual return date", "warning");
    return;
  }

  const returnD = new Date(return_date);
  const issueD = new Date(selectedTransaction.issue_date);
  if (returnD < issueD) {
    showToast("Return date cannot be earlier than the issue date", "warning");
    return;
  }

  try {
    const result = await fetchAPI(`/api/transactions/${selectedTransaction.id}/return`, {
      method: "PUT",
      body: JSON.stringify({ return_date })
    });

    showToast("Book returned and transaction closed!", "success");

    // Hide panel & show receipt
    document.getElementById("return-details-panel").style.display = "none";
    document.getElementById("no-selection-placeholder").style.display = "block";

    const successBox = document.getElementById("return-success-box");
    const details = document.getElementById("return-success-details");

    details.innerHTML = `
      <strong>Transaction #${result.id} Closed</strong><br>
      Book: <strong>${escapeHTML(result.book_title)}</strong> (Inventory copy restored)<br>
      Borrower: <strong>${escapeHTML(result.member_name)}</strong> (${escapeHTML(result.member_roll_number)})<br>
      Return Date: <strong>${formatDate(result.return_date)}</strong><br>
      Fine Assessed & Settled: <strong style="color: ${result.fine > 0 ? 'var(--danger)' : 'var(--success)'};">${formatCurrency(result.fine)}</strong>
      ${result.overdue_days > 0 ? `(${result.overdue_days} days overdue)` : '(On-time return)'}
    `;

    successBox.style.display = "block";
    selectedTransaction = null;
    loadActiveLoans();
  } catch (err) {
    showToast(err.message, "error");
  }
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
