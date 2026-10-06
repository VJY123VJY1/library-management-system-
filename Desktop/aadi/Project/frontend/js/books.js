/**
 * Books Management JavaScript Logic
 */

let allBooks = [];
let editingBookId = null;

document.addEventListener("DOMContentLoaded", () => {
  initBookEvents();
  loadBooks();
});

function initBookEvents() {
  const searchInput = document.getElementById("book-search-input");
  const categoryFilter = document.getElementById("book-category-filter");
  const refreshBtn = document.getElementById("refresh-books-btn");
  const openAddBtn = document.getElementById("open-add-book-btn");
  const closeBtn = document.getElementById("close-book-modal");
  const cancelBtn = document.getElementById("cancel-book-modal");
  const bookForm = document.getElementById("book-form");

  // Search and filter triggers (debounced search)
  let searchTimeout = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadBooks, 300);
  });

  categoryFilter.addEventListener("change", loadBooks);
  refreshBtn.addEventListener("click", loadBooks);

  // Modal open/close
  openAddBtn.addEventListener("click", () => openBookModal());
  closeBtn.addEventListener("click", closeBookModal);
  cancelBtn.addEventListener("click", closeBookModal);

  // Form submit
  bookForm.addEventListener("submit", handleBookFormSubmit);
}

async function loadBooks() {
  const search = document.getElementById("book-search-input").value.trim();
  const category = document.getElementById("book-category-filter").value;
  const tbody = document.getElementById("books-table-body");
  const countBadge = document.getElementById("books-count");

  let query = "/api/books?";
  if (search) query += `search=${encodeURIComponent(search)}&`;
  if (category && category !== "All") query += `category=${encodeURIComponent(category)}&`;

  try {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div class="empty-state-icon">⏳</div>
          <h3>Fetching catalog...</h3>
        </td>
      </tr>
    `;

    const books = await fetchAPI(query);
    allBooks = books;
    countBadge.textContent = books.length;

    renderBooksTable(books);
  } catch (err) {
    showToast("Error loading books: " + err.message, "error");
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Failed to load books</h3>
          <p>${escapeHTML(err.message)}</p>
        </td>
      </tr>
    `;
  }
}

function renderBooksTable(books) {
  const tbody = document.getElementById("books-table-body");
  if (!tbody) return;

  if (books.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div class="empty-state-icon">📚</div>
          <h3>No books found</h3>
          <p>Try adjusting your search criteria or add a new book to the catalog.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = books.map(book => {
    const isAvailable = book.available_quantity > 0;
    const isLow = book.available_quantity === 1;
    const badgeClass = !isAvailable ? "badge-out" : (isLow ? "badge-low" : "badge-available");
    const badgeText = !isAvailable ? "Out of Stock" : (isLow ? "1 Left" : "Available");

    return `
      <tr>
        <td><strong>#${book.id}</strong></td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${escapeHTML(book.title)}</div>
          <div style="font-size: 12px; color: var(--text-muted);">
            By ${escapeHTML(book.author)} ${book.publisher ? `• ${escapeHTML(book.publisher)}` : ""} ${book.publication_year ? `(${book.publication_year})` : ""}
          </div>
        </td>
        <td><code>${escapeHTML(book.isbn)}</code></td>
        <td><span class="badge" style="background-color: var(--primary-light); color: var(--primary);">${escapeHTML(book.category)}</span></td>
        <td><strong>${book.quantity}</strong></td>
        <td><strong style="color: ${isAvailable ? 'var(--success)' : 'var(--danger)'};">${book.available_quantity}</strong></td>
        <td>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px;">
            ${isAvailable ? `
              <a href="issue.html?book_id=${book.id}" class="btn btn-primary btn-sm" title="Issue Copy">
                Issue
              </a>
            ` : `
              <button class="btn btn-secondary btn-sm" disabled title="No copies available">
                Issue
              </button>
            `}
            <button class="btn btn-secondary btn-sm" onclick="editBook(${book.id})" title="Edit Book">
              ✏️
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteBookConfirm(${book.id}, '${escapeHTML(book.title).replace(/'/g, "\\'")}')" title="Delete Book">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openBookModal(book = null) {
  const modal = document.getElementById("book-modal");
  const modalTitle = document.getElementById("book-modal-title");
  const form = document.getElementById("book-form");
  const hint = document.getElementById("book-quantity-hint");

  form.reset();

  if (book) {
    editingBookId = book.id;
    modalTitle.textContent = `Edit Book: ${book.title}`;
    document.getElementById("book-form-id").value = book.id;
    document.getElementById("book-isbn").value = book.isbn;
    document.getElementById("book-title").value = book.title;
    document.getElementById("book-author").value = book.author;
    document.getElementById("book-category").value = book.category;
    document.getElementById("book-publisher").value = book.publisher || "";
    document.getElementById("book-year").value = book.publication_year || "";
    document.getElementById("book-quantity").value = book.quantity;

    const issuedCount = book.quantity - book.available_quantity;
    hint.textContent = `Currently ${issuedCount} issued out. Total quantity must be >= ${issuedCount}.`;
  } else {
    editingBookId = null;
    modalTitle.textContent = "Add New Book";
    document.getElementById("book-form-id").value = "";
    hint.textContent = "Total physical copies in library inventory";
  }

  modal.classList.add("show");
}

function closeBookModal() {
  const modal = document.getElementById("book-modal");
  modal.classList.remove("show");
  editingBookId = null;
}

function editBook(id) {
  const book = allBooks.find(b => b.id === id);
  if (book) {
    openBookModal(book);
  }
}

async function deleteBookConfirm(id, title) {
  if (!confirm(`Are you sure you want to permanently delete "${title}" from the library catalog?\n\nNote: If there are active borrowed copies, deletion will be blocked.`)) {
    return;
  }

  try {
    await fetchAPI(`/api/books/${id}`, { method: "DELETE" });
    showToast(`Book "${title}" was successfully deleted`, "success");
    loadBooks();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleBookFormSubmit(e) {
  e.preventDefault();

  const title = document.getElementById("book-title").value.trim();
  const isbn = document.getElementById("book-isbn").value.trim();
  const author = document.getElementById("book-author").value.trim();
  const category = document.getElementById("book-category").value.trim();
  const publisher = document.getElementById("book-publisher").value.trim() || null;
  const yearVal = document.getElementById("book-year").value;
  const publication_year = yearVal ? parseInt(yearVal, 10) : null;
  const quantity = parseInt(document.getElementById("book-quantity").value, 10);

  if (!title || !isbn || !author || !category || isNaN(quantity) || quantity < 1) {
    showToast("Please fill all required fields with valid values", "warning");
    return;
  }

  const payload = {
    isbn,
    title,
    author,
    category,
    publisher,
    publication_year,
    quantity
  };

  try {
    if (editingBookId) {
      await fetchAPI(`/api/books/${editingBookId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      showToast(`Book "${title}" updated successfully!`, "success");
    } else {
      await fetchAPI("/api/books", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showToast(`New book "${title}" added to catalog!`, "success");
    }

    closeBookModal();
    loadBooks();
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
