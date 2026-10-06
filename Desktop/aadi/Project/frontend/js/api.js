/**
 * Central API Client & UI Utilities for College Library Management System
 */

// Determine API Base URL automatically
const API_BASE_URL = (window.location.port === "8000" || window.location.origin.includes("8000"))
  ? "" 
  : "http://127.0.0.1:8000";

/**
 * Universal Fetch wrapper with error extraction and JSON parsing.
 */
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const contentType = response.headers.get("content-type");
    let data = null;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      let errorMessage = "An error occurred";
      if (data && data.detail) {
        if (Array.isArray(data.detail)) {
          errorMessage = data.detail.map(e => `${e.loc ? e.loc.join('.') + ': ' : ''}${e.msg}`).join(", ");
        } else {
          errorMessage = data.detail;
        }
      } else if (typeof data === "string") {
        errorMessage = data;
      }
      throw new Error(errorMessage);
    }

    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

/**
 * Toast Notification System
 */
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast-message toast-${type}`;
  
  const icon = type === "success" ? "✓" : type === "error" ? "✕" : type === "warning" ? "⚠" : "ℹ";
  toast.innerHTML = `<span><strong>${icon}</strong> ${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Currency Formatter (INR ₹)
 */
function formatCurrency(amount) {
  const num = Number(amount || 0);
  return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Date Formatter (DD Mon YYYY)
 */
function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

/**
 * Initialize Sidebar and Mobile Drawer Navigation
 */
function setupNavigation() {
  // Mobile drawer toggle
  const menuBtn = document.getElementById("mobile-menu-toggle");
  const sidebar = document.getElementById("main-sidebar");

  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });

    // Close on outside click on mobile
    document.addEventListener("click", (e) => {
      if (window.innerWidth <= 900 && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
        sidebar.classList.remove("open");
      }
    });
  }

  // Update live system date in topbar
  const dateElem = document.getElementById("system-date-display");
  if (dateElem) {
    const now = new Date();
    dateElem.textContent = now.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }
}

// Auto-run navigation setup on DOM load
document.addEventListener("DOMContentLoaded", setupNavigation);
