/**
 * Members Management JavaScript Logic
 */

let allMembers = [];
let editingMemberId = null;

document.addEventListener("DOMContentLoaded", () => {
  initMemberEvents();
  loadMembers();
});

function initMemberEvents() {
  const searchInput = document.getElementById("member-search-input");
  const deptFilter = document.getElementById("member-dept-filter");
  const refreshBtn = document.getElementById("refresh-members-btn");
  const openAddBtn = document.getElementById("open-add-member-btn");
  const closeBtn = document.getElementById("close-member-modal");
  const cancelBtn = document.getElementById("cancel-member-modal");
  const memberForm = document.getElementById("member-form");

  // Details modal
  const closeDetailBtn = document.getElementById("close-member-detail-modal");
  const closeDetailFooterBtn = document.getElementById("close-member-detail-btn");

  let searchTimeout = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadMembers, 300);
  });

  deptFilter.addEventListener("change", loadMembers);
  refreshBtn.addEventListener("click", loadMembers);

  openAddBtn.addEventListener("click", () => openMemberModal());
  closeBtn.addEventListener("click", closeMemberModal);
  cancelBtn.addEventListener("click", closeMemberModal);

  closeDetailBtn.addEventListener("click", closeMemberDetailModal);
  closeDetailFooterBtn.addEventListener("click", closeMemberDetailModal);

  memberForm.addEventListener("submit", handleMemberFormSubmit);
}

async function loadMembers() {
  const search = document.getElementById("member-search-input").value.trim();
  const dept = document.getElementById("member-dept-filter").value;
  const tbody = document.getElementById("members-table-body");
  const countBadge = document.getElementById("members-count");

  let query = "/api/members?";
  if (search) query += `search=${encodeURIComponent(search)}&`;
  if (dept && dept !== "All") query += `department=${encodeURIComponent(dept)}&`;

  try {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div class="empty-state-icon">⏳</div>
          <h3>Fetching members...</h3>
        </td>
      </tr>
    `;

    const members = await fetchAPI(query);
    allMembers = members;
    countBadge.textContent = members.length;

    renderMembersTable(members);
  } catch (err) {
    showToast("Error loading members: " + err.message, "error");
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Failed to load members</h3>
          <p>${escapeHTML(err.message)}</p>
        </td>
      </tr>
    `;
  }
}

function renderMembersTable(members) {
  const tbody = document.getElementById("members-table-body");
  if (!tbody) return;

  if (members.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div class="empty-state-icon">👥</div>
          <h3>No members found</h3>
          <p>Register a student or faculty member to start tracking library loans.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = members.map(m => {
    const hasActiveLoans = m.active_loans_count > 0;

    return `
      <tr>
        <td><strong>#${m.id}</strong></td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${escapeHTML(m.name)}</div>
        </td>
        <td><code>${escapeHTML(m.roll_number)}</code></td>
        <td><span class="badge" style="background-color: var(--primary-light); color: var(--primary);">${escapeHTML(m.department)}</span></td>
        <td>
          <div>📧 ${escapeHTML(m.email)}</div>
          ${m.phone ? `<div style="font-size: 12px; color: var(--text-muted);">📞 ${escapeHTML(m.phone)}</div>` : ""}
        </td>
        <td>${formatDate(m.registration_date)}</td>
        <td>
          <span class="badge ${hasActiveLoans ? 'badge-issued' : 'badge-available'}">
            ${m.active_loans_count} active
          </span>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px;">
            <button class="btn btn-primary btn-sm" onclick="viewMemberDetails(${m.id})" title="View Profile & Loans">
              Details
            </button>
            <a href="issue.html?member_id=${m.id}" class="btn btn-secondary btn-sm" title="Issue Book to Member">
              📤 Issue
            </a>
            <button class="btn btn-secondary btn-sm" onclick="editMember(${m.id})" title="Edit Member">
              ✏️
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteMemberConfirm(${m.id}, '${escapeHTML(m.name).replace(/'/g, "\\'")}')" title="Delete Member">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openMemberModal(member = null) {
  const modal = document.getElementById("member-modal");
  const modalTitle = document.getElementById("member-modal-title");
  const form = document.getElementById("member-form");

  form.reset();

  if (member) {
    editingMemberId = member.id;
    modalTitle.textContent = `Edit Member: ${member.name}`;
    document.getElementById("member-form-id").value = member.id;
    document.getElementById("member-name").value = member.name;
    document.getElementById("member-roll").value = member.roll_number;
    document.getElementById("member-dept").value = member.department;
    document.getElementById("member-email").value = member.email;
    document.getElementById("member-phone").value = member.phone || "";
  } else {
    editingMemberId = null;
    modalTitle.textContent = "Register New Member";
    document.getElementById("member-form-id").value = "";
  }

  modal.classList.add("show");
}

function closeMemberModal() {
  const modal = document.getElementById("member-modal");
  modal.classList.remove("show");
  editingMemberId = null;
}

function editMember(id) {
  const member = allMembers.find(m => m.id === id);
  if (member) {
    openMemberModal(member);
  }
}

async function viewMemberDetails(id) {
  const modal = document.getElementById("member-detail-modal");
  const body = document.getElementById("member-detail-body");
  modal.classList.add("show");

  try {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⏳</div>
        <h3>Loading member details...</h3>
      </div>
    `;

    const data = await fetchAPI(`/api/members/${id}`);

    const txRows = (data.transactions && data.transactions.length > 0)
      ? data.transactions.map(tx => {
          let badgeClass = "badge-issued";
          if (tx.status === "Returned") badgeClass = "badge-returned";
          else if (tx.status === "Overdue") badgeClass = "badge-overdue";

          return `
            <tr>
              <td><strong>#${tx.id}</strong></td>
              <td>${escapeHTML(tx.book_title)}</td>
              <td>${formatDate(tx.issue_date)}</td>
              <td>${formatDate(tx.due_date)}</td>
              <td>${tx.return_date ? formatDate(tx.return_date) : '<span style="color: var(--text-muted);">Active</span>'}</td>
              <td><span class="badge ${badgeClass}">${tx.status}</span></td>
              <td>${tx.fine > 0 ? `<strong style="color: var(--danger);">${formatCurrency(tx.fine)}</strong>` : '₹0'}</td>
            </tr>
          `;
        }).join("")
      : `
        <tr>
          <td colspan="7" class="empty-state" style="padding: 20px;">
            <p>No borrow history on record for this member.</p>
          </td>
        </tr>
      `;

    body.innerHTML = `
      <div style="background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: gap; gap: 12px;">
          <div>
            <h3 style="font-size: 18px; font-weight: 700; color: var(--text-main);">${escapeHTML(data.name)}</h3>
            <p style="color: var(--text-muted); font-size: 13px;">Roll No: <strong>${escapeHTML(data.roll_number)}</strong> • Dept: <strong>${escapeHTML(data.department)}</strong></p>
            <p style="color: var(--text-muted); font-size: 13px;">📧 ${escapeHTML(data.email)} ${data.phone ? `• 📞 ${escapeHTML(data.phone)}` : ""}</p>
          </div>
          <div>
            <span class="badge ${data.active_loans_count > 0 ? 'badge-issued' : 'badge-available'}" style="font-size: 13px; padding: 6px 12px;">
              ${data.active_loans_count} Active Loan(s)
            </span>
          </div>
        </div>
      </div>

      <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 12px; color: var(--text-main);">Borrowing & Return History</h4>
      <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Book Title</th>
              <th>Issued</th>
              <th>Due Date</th>
              <th>Returned</th>
              <th>Status</th>
              <th>Fine</th>
            </tr>
          </thead>
          <tbody>
            ${txRows}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Failed to load member profile</h3>
        <p>${escapeHTML(err.message)}</p>
      </div>
    `;
  }
}

function closeMemberDetailModal() {
  const modal = document.getElementById("member-detail-modal");
  modal.classList.remove("show");
}

async function deleteMemberConfirm(id, name) {
  if (!confirm(`Are you sure you want to delete member "${name}"?\n\nNote: If they have active borrowed books, deletion will be rejected.`)) {
    return;
  }

  try {
    await fetchAPI(`/api/members/${id}`, { method: "DELETE" });
    showToast(`Member "${name}" was successfully removed`, "success");
    loadMembers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleMemberFormSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("member-name").value.trim();
  const roll_number = document.getElementById("member-roll").value.trim();
  const department = document.getElementById("member-dept").value.trim();
  const email = document.getElementById("member-email").value.trim();
  const phone = document.getElementById("member-phone").value.trim() || null;

  if (!name || !roll_number || !department || !email) {
    showToast("Please fill all required fields", "warning");
    return;
  }

  const payload = {
    name,
    roll_number,
    department,
    email,
    phone
  };

  try {
    if (editingMemberId) {
      await fetchAPI(`/api/members/${editingMemberId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      showToast(`Member "${name}" updated successfully!`, "success");
    } else {
      await fetchAPI("/api/members", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showToast(`Member "${name}" registered successfully!`, "success");
    }

    closeMemberModal();
    loadMembers();
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
