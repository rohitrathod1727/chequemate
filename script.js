
const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "chequemate_transactions_v1";
const BUDGET_KEY = "chequemate_budget_v1";

const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
};

const money = (amount) =>
  Number(amount).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2
  });

const makeId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function demoTransactions() {
  const date = today();

  return [
    {
      id: makeId(),
      date,
      type: "deposit",
      amount: 25000,
      description: "Opening deposit",
      category: "Salary",
      chequeNumber: "",
      payee: "",
      status: ""
    },
    {
      id: makeId(),
      date,
      type: "withdrawal",
      amount: 1200,
      description: "Monthly groceries",
      category: "Food",
      chequeNumber: "",
      payee: "",
      status: ""
    },
    {
      id: makeId(),
      date,
      type: "cheque",
      amount: 3500,
      description: "Education fees",
      category: "Education",
      chequeNumber: "CHQ-1001",
      payee: "Demo College",
      status: "Issued"
    }
  ];
}

function loadTransactions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved !== null) {
      const parsed = JSON.parse(saved);

      if (
        Array.isArray(parsed) &&
        parsed.every(t =>
          t &&
          typeof t.id === "string" &&
          typeof t.date === "string" &&
          Number.isFinite(t.amount) &&
          t.amount > 0 &&
          ["deposit", "withdrawal", "cheque"].includes(t.type)
        )
      ) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Could not load saved transactions:", error);
  }

  return demoTransactions();
}

let transactions = loadTransactions();

let budget = (() => {
  try {
    const value = Number(localStorage.getItem(BUDGET_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
})();

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    localStorage.setItem(BUDGET_KEY, String(budget));
    return true;
  } catch (error) {
    console.error("Could not save data:", error);
    showMessage(
      "Could not save data. Browser storage may be unavailable or full.",
      "error"
    );
    return false;
  }
}

function showMessage(message, type) {
  $("formMessage").textContent = message;
  $("formMessage").className = type;
}

function signedAmount(t) {
  return t.type === "deposit" ? t.amount : -t.amount;
}

function sortedTransactions() {
  return [...transactions].sort((a, b) =>
    a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  );
}

function calculateBalance() {
  return transactions.reduce((total, t) => total + signedAmount(t), 0);
}

function updateDashboard() {
  const deposits = transactions
    .filter(t => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);

  const withdrawals = transactions
    .filter(t => t.type !== "deposit")
    .reduce((sum, t) => sum + t.amount, 0);

  const pending = transactions.filter(
    t => t.type === "cheque" && t.status === "Issued"
  ).length;

  $("balance").textContent = money(calculateBalance());
  $("deposits").textContent = money(deposits);
  $("withdrawals").textContent = money(withdrawals);
  $("pending").textContent = pending;

  renderBudget();
  renderTransactions();
}

function renderTransactions() {
  const search = $("search").value.trim().toLowerCase();
  const typeFilter = $("filterType").value;
  const statusFilter = $("filterStatus").value;

  const ordered = sortedTransactions();
  const balances = new Map();
  let runningBalance = 0;

  // Calculate each transaction's balance in date order.
  ordered.forEach(t => {
    runningBalance += signedAmount(t);
    balances.set(t.id, runningBalance);
  });

  const visible = ordered.filter(t => {
    const searchable = [
      t.description,
      t.payee,
      t.chequeNumber,
      t.category,
      t.date
    ].join(" ").toLowerCase();

    const matchesSearch = searchable.includes(search);
    const matchesType = typeFilter === "all" || t.type === typeFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (t.type === "cheque" && t.status === statusFilter);

    return matchesSearch && matchesType && matchesStatus;
  });

  // Display newest transactions first.
  visible.reverse();

  $("transactionList").replaceChildren();
  $("emptyMessage").classList.toggle("hidden", visible.length !== 0);

  visible.forEach(t => {
    const tr = document.createElement("tr");

    const details = t.type === "cheque"
      ? `${t.chequeNumber || "No number"}\n${t.payee || "No payee"}`
      : "—";

    const typeLabel = {
      deposit: "Deposit",
      withdrawal: "Withdrawal",
      cheque: "Cheque"
    }[t.type];

    const amountClass =
      t.type === "deposit" ? "amount-deposit" : "amount-withdrawal";

    const amountText =
      (t.type === "deposit" ? "+" : "−") + money(t.amount);

    const statusMarkup = t.type === "cheque"
      ? `<span class="status status-${t.status}">${t.status}</span>`
      : "";

    const cells = [
      t.date,
      t.description,
      typeLabel,
      details,
      amountText,
      money(balances.get(t.id))
    ];

    cells.forEach((value, index) => {
      const td = document.createElement("td");

      if (index === 4) {
        td.className = amountClass;
      }

      // Use textContent to avoid inserting user input as HTML.
      td.textContent = value;
      tr.appendChild(td);

      if (index === 3 && statusMarkup) {
        const br = document.createElement("br");
        const status = document.createElement("span");
        status.className = `status status-${t.status}`;
        status.textContent = t.status;
        td.appendChild(br);
        td.appendChild(status);
      }
    });

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");

    deleteButton.className = "delete-btn";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${t.description}`);

    deleteButton.addEventListener("click", () => {
      if (confirm(`Delete transaction "${t.description}"?`)) {
        transactions = transactions.filter(item => item.id !== t.id);
        saveData();
        updateDashboard();
      }
    });

    actionCell.appendChild(deleteButton);
    tr.appendChild(actionCell);
    $("transactionList").appendChild(tr);
  });
}

function renderBudget() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const currentMonth = `${now.getFullYear()}-${month}`;

  const spent = transactions
    .filter(t =>
      t.date.startsWith(currentMonth) && t.type !== "deposit"
    )
    .reduce((sum, t) => sum + t.amount, 0);

  $("spent").textContent = money(spent);
  $("budgetTotal").textContent = budget > 0 ? money(budget) : "Not set";

  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const progress = $("budgetProgress");

  progress.style.width = `${Math.min(percentage, 100)}%`;
  progress.classList.toggle("over", percentage >= 100);

  if (budget <= 0) {
    $("budgetMessage").textContent =
      "Set a budget to track your monthly spending.";
  } else if (spent > budget) {
    $("budgetMessage").textContent =
      `Budget exceeded by ${money(spent - budget)}.`;
  } else {
    $("budgetMessage").textContent =
      `${Math.min(percentage, 100).toFixed(1)}% used. ` +
      `${money(budget - spent)} remaining.`;
  }
}

function updateChequeFields() {
  const isCheque = $("type").value === "cheque";

  ["chequeField", "payeeField", "statusField"].forEach(id => {
    $(id).classList.toggle("hidden", !isCheque);
  });

  $("chequeNumber").required = isCheque;
  $("payee").required = isCheque;
  $("chequeStatus").required = isCheque;
}

$("type").addEventListener("change", updateChequeFields);

$("transactionForm").addEventListener("submit", event => {
  event.preventDefault();

  const amount = Number($("amount").value);
  const description = $("description").value.trim();
  const date = $("date").value;
  const type = $("type").value;
  const chequeNumber = $("chequeNumber").value.trim();
  const payee = $("payee").value.trim();

  if (!description || !date || !Number.isFinite(amount) || amount <= 0) {
    showMessage("Enter a description, valid date and amount above zero.", "error");
    return;
  }

  if (date > today()) {
    showMessage("Choose today or an earlier date.", "error");
    return;
  }

  if (type === "cheque" && (!chequeNumber || !payee)) {
    showMessage("Enter the cheque number and payee name.", "error");
    return;
  }

  const transaction = {
    id: makeId(),
    date,
    type,
    amount: Math.round(amount * 100) / 100,
    description,
    category: $("category").value,
    chequeNumber: type === "cheque" ? chequeNumber : "",
    payee: type === "cheque" ? payee : "",
    status: type === "cheque" ? $("chequeStatus").value : ""
  };

  transactions.push(transaction);

  if (!saveData()) {
    transactions.pop();
    return;
  }

  $("transactionForm").reset();
  $("date").value = today();
  updateChequeFields();
  updateDashboard();
  showMessage("Transaction added successfully!", "success");
});

$("transactionForm").addEventListener("reset", () => {
  setTimeout(() => {
    $("date").value = today();
    updateChequeFields();
  }, 0);
});

["search", "filterType", "filterStatus"].forEach(id => {
  $(id).addEventListener("input", renderTransactions);
  $(id).addEventListener("change", renderTransactions);
});

$("budgetForm").addEventListener("submit", event => {
  event.preventDefault();

  const value = Number($("budget").value);

  if (!Number.isFinite(value) || value <= 0) {
    alert("Enter a monthly budget greater than zero.");
    return;
  }

  budget = Math.round(value * 100) / 100;

  if (!saveData()) return;

  renderBudget();
  alert("Monthly budget saved.");
});

$("exportBtn").addEventListener("click", () => {
  const headers = [
    "Date", "Description", "Type", "Category",
    "Cheque Number", "Payee", "Status", "Amount", "Running Balance"
  ];

  const ordered = sortedTransactions();
  let runningBalance = 0;

  const rows = ordered.map(t => {
    runningBalance += signedAmount(t);

    return [
      t.date,
      t.description,
      t.type,
      t.category,
      t.chequeNumber,
      t.payee,
      t.status,
      t.amount.toFixed(2),
      runningBalance.toFixed(2)
    ];
  });

  // Quote every field so commas and quotation marks are CSV-safe.
  const csvCell = value =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csv = [headers, ...rows]
    .map(row => row.map(csvCell).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "chequemate-transactions.csv";
  link.click();

  URL.revokeObjectURL(url);
});

$("resetBtn").addEventListener("click", () => {
  if (!confirm("Reset all transactions and budget to demo data?")) return;

  const previousTransactions = transactions;
  const previousBudget = budget;

  transactions = demoTransactions();
  budget = 0;

  if (!saveData()) {
    transactions = previousTransactions;
    budget = previousBudget;
    return;
  }

  $("budget").value = "";
  $("search").value = "";
  $("filterType").value = "all";
  $("filterStatus").value = "all";

  updateDashboard();
  showMessage("Demo data restored.", "success");
});

$("date").value = today();
updateChequeFields();
updateDashboard();
