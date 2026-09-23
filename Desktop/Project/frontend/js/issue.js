/**
 * Issue Book JavaScript Logic
 */

let booksList = [];
let membersList = [];

document.addEventListener("DOMContentLoaded", () => {
  initIssueForm();
  loadData();
});

function initIssueForm() {
  const form = document.getElementById("issue-book-form");
  const memberSelect = document.getElementById("select-member");
  const bookSelect = document.getElementById("select-book");
  const issueDateInput = document.getElementById("issue-date");
  const dueDateInput = document.getElementById("due-date");
  const issueAnotherBtn = document.getElementById("issue-another-btn");

  // Initialize dates
  const today = new Date();
  const todayStr = formatDateForInput(today);
  issueDateInput.value = todayStr;

  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 14);
  dueDateInput.value = formatDateForInput(defaultDue);

  // When issue date changes, update default due date (+14 days)
  issueDateInput.addEventListener("change", () => {
    if (issueDateInput.value) {
      const iDate = new Date(issueDateInput.value);
      if (!isNaN(iDate.getTime())) {
        iDate.setDate(iDate.getDate() + 14);
        dueDateInput.value = formatDateForInput(iDate);
      }
    }
  });

  memberSelect.addEventListener("change", handleMemberSelection);
  bookSelect.addEventListener("change", handleBookSelection);
  form.addEventListener("submit", handleIssueSubmit);

  issueAnotherBtn.addEventListener("click", () => {
    document.getElementById("issue-success-box").style.display = "none";
    document.getElementById("issue-form-card").style.display = "block";
    form.reset();
    issueDateInput.value = formatDateForInput(new Date());
    const newDue = new Date();
    newDue.setDate(newDue.getDate() + 14);
    dueDateInput.value = formatDateForInput(newDue);
    document.getElementById("member-preview-card").style.display = "none";
    document.getElementById("book-preview-card").style.display = "none";
    loadData();
  });
}

function formatDateForInput(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function loadData() {
  try {
    const [books, members] = await Promise.all([
      fetchAPI("/api/books"),
      fetchAPI("/api/members")
    ]);

    booksList = books;
    membersList = members;

    populateMemberSelect(members);
    populateBookSelect(books);

    // Check URL query parameters for pre-selected items
    const urlParams = new URLSearchParams(window.location.search);
    const preBookId = urlParams.get("book_id");
    const preMemberId = urlParams.get("member_id");

    if (preMemberId) {
      const mSelect = document.getElementById("select-member");
      mSelect.value = preMemberId;
      handleMemberSelection();
    }

    if (preBookId) {
      const bSelect = document.getElementById("select-book");
      bSelect.value = preBookId;
      handleBookSelection();
    }
  } catch (err) {
    showToast("Error loading catalog data: " + err.message, "error");
  }
}

function populateMemberSelect(members) {
  const select = document.getElementById("select-member");
  select.innerHTML = '<option value="">-- Choose Member (Search by Name or Roll No) --</option>';

  members.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.name} (${m.roll_number}) - ${m.department}`;
    select.appendChild(opt);
  });
}

function populateBookSelect(books) {
  const select = document.getElementById("select-book");
  select.innerHTML = '<option value="">-- Choose Book (Search by Title or ISBN) --</option>';

  books.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.id;
    const stockStatus = b.available_quantity > 0 ? `[${b.available_quantity} available]` : "[OUT OF STOCK]";
    opt.textContent = `${b.title} by ${b.author} - ${stockStatus}`;
    if (b.available_quantity <= 0) {
      opt.disabled = true;
    }
    select.appendChild(opt);
  });
}

function handleMemberSelection() {
  const memberId = parseInt(document.getElementById("select-member").value, 10);
  const card = document.getElementById("member-preview-card");
  if (!memberId) {
    card.style.display = "none";
    return;
  }

  const member = membersList.find(m => m.id === memberId);
  if (member) {
    document.getElementById("preview-member-name").textContent = member.name;
    document.getElementById("preview-member-info").textContent = `Roll: ${member.roll_number} • Dept: ${member.department} • Email: ${member.email}`;
    const badge = document.getElementById("preview-member-badge");
    badge.textContent = `${member.active_loans_count || 0} active loan(s)`;
    badge.className = `badge ${member.active_loans_count > 0 ? 'badge-issued' : 'badge-available'}`;
    card.style.display = "block";
  }
}

function handleBookSelection() {
  const bookId = parseInt(document.getElementById("select-book").value, 10);
  const card = document.getElementById("book-preview-card");
  const submitBtn = document.getElementById("submit-issue-btn");

  if (!bookId) {
    card.style.display = "none";
    submitBtn.disabled = false;
    return;
  }

  const book = booksList.find(b => b.id === bookId);
  if (book) {
    document.getElementById("preview-book-title").textContent = book.title;
    document.getElementById("preview-book-info").textContent = `Author: ${book.author} • Category: ${book.category} • ISBN: ${book.isbn}`;
    
    const badge = document.getElementById("preview-book-badge");
    if (book.available_quantity > 0) {
      badge.textContent = `${book.available_quantity} of ${book.quantity} copies in stock`;
      badge.className = "badge badge-available";
      submitBtn.disabled = false;
    } else {
      badge.textContent = "Out of Stock (0 Available)";
      badge.className = "badge badge-out";
      submitBtn.disabled = true;
    }
    card.style.display = "block";
  }
}

async function handleIssueSubmit(e) {
  e.preventDefault();

  const member_id = parseInt(document.getElementById("select-member").value, 10);
  const book_id = parseInt(document.getElementById("select-book").value, 10);
  const issue_date = document.getElementById("issue-date").value;
  const due_date = document.getElementById("due-date").value;

  if (!member_id || !book_id || !issue_date || !due_date) {
    showToast("Please fill in all required fields", "warning");
    return;
  }

  if (new Date(due_date) < new Date(issue_date)) {
    showToast("Due date cannot be before issue date", "warning");
    return;
  }

  const payload = {
    member_id,
    book_id,
    issue_date,
    due_date
  };

  try {
    const result = await fetchAPI("/api/transactions/issue", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    showToast("Book issued successfully!", "success");

    // Display confirmation box
    document.getElementById("issue-form-card").style.display = "none";
    const successBox = document.getElementById("issue-success-box");
    const details = document.getElementById("issue-success-details");

    details.innerHTML = `
      <strong>Transaction #${result.id}</strong><br>
      Book: <strong>${escapeHTML(result.book_title)}</strong> (ISBN: ${escapeHTML(result.book_isbn)})<br>
      Issued to: <strong>${escapeHTML(result.member_name)}</strong> (Roll: ${escapeHTML(result.member_roll_number)})<br>
      Issue Date: <strong>${formatDate(result.issue_date)}</strong> • Return Deadline: <strong>${formatDate(result.due_date)}</strong>
    `;

    successBox.style.display = "block";
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
