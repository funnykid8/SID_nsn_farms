
import { createApp } from "https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js";

const STORAGE_KEY = "nsn_farms_erp_v1";

const today = () => new Date().toISOString().slice(0, 10);

const money = value =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

const schema = {
  transactions: {
    title: "Transactions",
    fields: [
      ["date", "Date", "date"],
      ["type", "Type", "select", ["Income", "Expense"]],
      ["category", "Category", "text"],
      ["description", "Description", "text"],
      ["party", "Buyer / Supplier", "text"],
      ["amount", "Amount (₹)", "number"]
    ]
  },
  payroll: {
    title: "Payroll",
    fields: [
      ["date", "Payment date", "date"],
      ["employee", "Employee", "text"],
      ["period", "Pay period", "text"],
      ["days", "Days worked", "number"],
      ["rate", "Daily rate (₹)", "number"],
      ["deductions", "Deductions (₹)", "number"],
      ["amount", "Amount paid (₹)", "number"]
    ]
  },
  crops: {
    title: "Crops & Farm Activities",
    fields: [
      ["date", "Date", "date"],
      ["crop", "Crop", "text"],
      ["field", "Field / Plot", "text"],
      ["area", "Area (acres)", "number"],
      ["activity", "Activity", "select",
        ["Sowing", "Irrigation", "Fertilising", "Spraying", "Harvesting", "Other"]],
      ["quantity", "Quantity", "number"],
      ["notes", "Notes", "text"]
    ]
  },
  employees: {
    title: "Employees",
    fields: [
      ["name", "Employee name", "text"],
      ["phone", "Phone", "tel"],
      ["role", "Role", "text"],
      ["rate", "Daily wage (₹)", "number"],
      ["joinDate", "Joining date", "date"],
      ["status", "Status", "select", ["Active", "Inactive"]]
    ]
  },
  buyers: {
    title: "Buyers & Suppliers",
    fields: [
      ["name", "Name", "text"],
      ["phone", "Phone", "tel"],
      ["address", "Address", "text"],
      ["type", "Type", "select", ["Buyer", "Supplier", "Both"]],
      ["notes", "Notes", "text"]
    ]
  },
  categories: {
    title: "Categories",
    fields: [
      ["name", "Category name", "text"],
      ["type", "Type", "select", ["Income", "Expense"]],
      ["notes", "Notes", "text"]
    ]
  },
  openingBalances: {
    title: "Opening Balances",
    fields: [
      ["date", "Date", "date"],
      ["account", "Account / Party", "text"],
      ["type", "Balance type", "select",
        ["Receivable", "Payable", "Cash", "Bank", "Stock"]],
      ["amount", "Amount (₹)", "number"],
      ["notes", "Notes", "text"]
    ]
  }
};

const navigation = [
  ["dashboard", "Dashboard", "⌂"],
  ["transactions", "Transactions", "₹"],
  ["payroll", "Payroll", "◷"],
  ["crops", "Crops & Activities", "♧"],
  ["reports", "Reports", "▥"],
  ["employees", "Employees", "♙"],
  ["buyers", "Buyers & Suppliers", "⇄"],
  ["categories", "Categories", "☷"],
  ["openingBalances", "Opening Balances", "◈"],
  ["backup", "Backup & Restore", "↓"],
  ["settings", "Settings", "⚙"]
];

function emptyDB() {
  return {
    transactions: [],
    payroll: [],
    crops: [],
    employees: [],
    buyers: [],
    categories: [],
    openingBalances: [],
    settings: { farmName: "NSN Farms" }
  };
}

function loadDB() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const db = { ...emptyDB(), ...saved };

    for (const key of Object.keys(emptyDB())) {
      if (key !== "settings" && !Array.isArray(db[key])) {
        db[key] = [];
      }
    }

    db.settings = {
      farmName: "NSN Farms",
      ...(saved.settings || {})
    };

    return db;
  } catch (error) {
    console.error("Could not load saved farm data:", error);
    return emptyDB();
  }
}

createApp({
  data() {
    return {
      db: loadDB(),
      page: "dashboard",
      search: "",
      showForm: false,
      editingId: null,
      form: {},
      notice: "",
      reportStart: today().slice(0, 4) + "-01-01",
      reportEnd: today(),
      reportType: "all"
    };
  },

  computed: {
    pageTitle() {
      if (this.page === "dashboard") return "Farm overview";
      if (this.page === "reports") return "Reports & summaries";
      if (this.page === "backup") return "Backup & restore";
      if (this.page === "settings") return "Farm settings";
      return schema[this.page]?.title || "NSN Farms";
    },

    rows() {
      const list = this.db[this.page];
      if (!Array.isArray(list)) return [];

      const query = this.search.trim().toLowerCase();

      return list.filter(row =>
        Object.values(row).some(value =>
          String(value ?? "").toLowerCase().includes(query)
        )
      );
    },

    totals() {
      const sum = (items, predicate = () => true) =>
        items.filter(predicate).reduce(
          (total, item) => total + Number(item.amount || 0), 0
        );

      const income = sum(this.db.transactions, x => x.type === "Income");
      const expenses = sum(this.db.transactions, x => x.type === "Expense");
      const payroll = sum(this.db.payroll);

      return {
        income,
        expenses,
        payroll,
        balance: income - expenses - payroll,
        transactions: this.db.transactions.length,
        employees: this.db.employees.filter(x => x.status !== "Inactive").length,
        crops: this.db.crops.length
      };
    },

    reportRows() {
      return this.db.transactions.filter(row =>
        (row.date || "") >= this.reportStart &&
        (row.date || "") <= this.reportEnd &&
        (this.reportType === "all" || row.type === this.reportType)
      );
    },

    reportTotals() {
      return this.reportRows.reduce((result, row) => {
        const amount = Number(row.amount || 0);
        if (row.type === "Income") result.income += amount;
        if (row.type === "Expense") result.expenses += amount;
        return result;
      }, { income: 0, expenses: 0 });
    }
  },

  methods: {
    go(page) {
      this.page = page;
      this.search = "";
      this.showForm = false;
      this.editingId = null;
    },

    message(text) {
      this.notice = text;
      window.clearTimeout(this.noticeTimer);
      this.noticeTimer = window.setTimeout(() => {
        this.notice = "";
      }, 3500);
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
        return true;
      } catch (error) {
        console.error(error);
        this.message("Could not save data. Export a backup and check browser storage.");
        return false;
      }
    },

    addNew() {
      if (!schema[this.page]) return;

      this.editingId = null;
      this.form = {};

      for (const [key, label, type] of schema[this.page].fields) {
        this.form[key] = type === "date" ? today() : "";
      }

      if (this.page === "transactions") this.form.type = "Expense";
      if (this.page === "employees") this.form.status = "Active";
      if (this.page === "buyers") this.form.type = "Buyer";

      this.showForm = true;
    },

    edit(row) {
      this.editingId = row.id;
      this.form = { ...row };
      this.showForm = true;
    },

    submitForm() {
      const fields = schema[this.page]?.fields;
      if (!fields) return;

      const record = { ...this.form };

      for (const [key, label, type] of fields) {
        if (type === "number") {
          record[key] = Number(record[key] || 0);
        }
      }

      if (this.page === "payroll" && !record.amount) {
        record.amount = Math.max(
          0,
          Number(record.days || 0) * Number(record.rate || 0) -
          Number(record.deductions || 0)
        );
      }

      const list = this.db[this.page];
      const previous = JSON.stringify(list);

      if (this.editingId) {
        const index = list.findIndex(row => row.id === this.editingId);
        if (index === -1) return;

        list[index] = { ...record, id: this.editingId };
      } else {
        list.unshift({
          ...record,
          id: globalThis.crypto?.randomUUID?.() ||
            `${Date.now()}-${Math.random()}`
        });
      }

      if (!this.save()) {
        this.db[this.page] = JSON.parse(previous);
        return;
      }

      this.showForm = false;
      this.message("Record saved successfully.");
    },

    remove(row) {
      if (!confirm("Delete this record? This cannot be undone.")) return;

      const previous = this.db[this.page];
      this.db[this.page] = previous.filter(item => item.id !== row.id);

      if (!this.save()) {
        this.db[this.page] = previous;
        return;
      }

      this.message("Record deleted.");
    },

    download(content, filename, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    exportCSV() {
      if (!this.rows.length) {
        this.message("No records to export.");
        return;
      }

      const keys = [...new Set(this.rows.flatMap(row => Object.keys(row)))];
      const quote = value =>
        '"' + String(value ?? "").replaceAll('"', '""') + '"';

      const csv = [
        keys.map(quote).join(","),
        ...this.rows.map(row => keys.map(key => quote(row[key])).join(","))
      ].join("\r\n");

      this.download(
        "\uFEFF" + csv,
        `${this.page}-${today()}.csv`,
        "text/csv;charset=utf-8"
      );
    },

    backup() {
      this.download(
        JSON.stringify(this.db, null, 2),
        `nsn-farms-backup-${today()}.json`,
        "application/json"
      );
      this.message("Backup exported.");
    },

    restore(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result));

          if (!data || typeof data !== "object" ||
              !Array.isArray(data.transactions) ||
              !Array.isArray(data.payroll) ||
              !Array.isArray(data.crops)) {
            throw new Error("Invalid backup");
          }

          if (!confirm("Replace current browser data with this backup?")) {
            return;
          }

          const previous = this.db;
          this.db = { ...emptyDB(), ...data };

          if (!this.save()) {
            this.db = previous;
            return;
          }

          this.go("dashboard");
          this.message("Backup restored.");
        } catch (error) {
          this.message("Invalid backup file. Current data was not replaced.");
        }
      };

      reader.readAsText(file);
      event.target.value = "";
    },

    clearAll() {
      if (!confirm("Delete all farm records saved in this browser? Export a backup first.")) {
        return;
      }

      const previous = this.db;
      this.db = emptyDB();

      if (!this.save()) {
        this.db = previous;
        return;
      }

      this.go("dashboard");
      this.message("Browser data cleared.");
    },

    printReport() {
      window.print();
    },

    fieldValue(key, value) {
      if (["amount", "rate", "deductions"].includes(key)) return money(value);
      return value ?? "—";
    }
  },

  // IMPORTANT: schema must be exposed to the Vue template.
  setup() {
    return { navigation, money, schema };
  },

  template: `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-icon">N</span>
          <div><b>NSN FARMS</b><small>Farm management ERP</small></div>
        </div>

        <div class="nav-caption">WORKSPACE</div>

        <button v-for="item in navigation" :key="item[0]"
          class="nav-item" :class="{active: page === item[0]}"
          @click="go(item[0])">
          <span class="nav-icon">{{item[2]}}</span>
          <span>{{item[1]}}</span>
        </button>

        <div class="sidebar-bottom">
          <span class="status-dot"></span> Browser mode
          <small>Data saved locally</small>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <div class="eyebrow">NSN FARMS / OPERATIONS</div>
            <h1>{{pageTitle}}</h1>
          </div>
          <div class="top-actions">
            <span class="date-label">{{new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}}</span>
            <button v-if="schema[page]" class="btn btn-dark" @click="addNew">＋ Add record</button>
          </div>
        </header>

        <div v-if="notice" class="notice">{{notice}}</div>

        <section v-if="page === 'dashboard'">
          <div class="welcome">
            <div>
              <span class="welcome-tag">FARM OPERATIONS</span>
              <h2>Welcome to {{db.settings.farmName || 'NSN Farms'}}</h2>
              <p>Track farm activity, manage payments and review your records.</p>
            </div>
            <span class="welcome-symbol">♧</span>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total income</div>
              <div class="stat-number">{{money(totals.income)}}</div>
              <div class="stat-note">Recorded income transactions</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total expenses</div>
              <div class="stat-number">{{money(totals.expenses)}}</div>
              <div class="stat-note">Recorded expense transactions</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Payroll paid</div>
              <div class="stat-number">{{money(totals.payroll)}}</div>
              <div class="stat-note">Recorded payroll entries</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Net recorded balance</div>
              <div class="stat-number" :class="{negative:totals.balance<0}">{{money(totals.balance)}}</div>
              <div class="stat-note">Income less expenses and payroll</div>
            </div>
          </div>

          <div class="dashboard-grid">
            <div class="panel">
              <div class="panel-heading">
                <div><h3>Quick actions</h3><p>Open a farm operation</p></div>
              </div>
              <div class="quick-grid">
                <button @click="go('transactions')"><span>₹</span><b>Transactions</b><small>Income and expenses</small></button>
                <button @click="go('payroll')"><span>◷</span><b>Payroll</b><small>Wages and payments</small></button>
                <button @click="go('crops')"><span>♧</span><b>Crop activities</b><small>Fields and operations</small></button>
                <button @click="go('reports')"><span>▥</span><b>Reports</b><small>Review records</small></button>
              </div>
            </div>

            <div class="panel">
              <div class="panel-heading">
                <div><h3>Farm records</h3><p>Saved in this browser</p></div>
              </div>
              <div class="record-line"><span>Active employees</span><b>{{totals.employees}}</b></div>
              <div class="record-line"><span>Transactions</span><b>{{totals.transactions}}</b></div>
              <div class="record-line"><span>Crop activities</span><b>{{totals.crops}}</b></div>
              <div class="record-line"><span>Buyers / suppliers</span><b>{{db.buyers.length}}</b></div>
              <button class="btn btn-outline full" @click="go('backup')">Manage backups →</button>
            </div>
          </div>

          <div class="panel">
            <div class="panel-heading">
              <div><h3>Recent transactions</h3><p>Latest recorded entries</p></div>
              <button class="text-button" @click="go('transactions')">View all →</button>
            </div>
            <div v-if="!db.transactions.length" class="empty">
              No transactions yet. Add your first transaction to get started.
            </div>
            <div v-else class="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th class="right">Amount</th></tr></thead>
                <tbody>
                  <tr v-for="row in db.transactions.slice(0,5)" :key="row.id">
                    <td>{{row.date || '—'}}</td>
                    <td>{{row.description || row.party || '—'}}</td>
                    <td>{{row.category || '—'}}</td>
                    <td>{{row.type}}</td>
                    <td class="right">{{money(row.amount)}}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section v-else-if="schema[page]">
          <div class="toolbar">
            <div class="searchbox">
              <span>⌕</span>
              <input v-model="search" placeholder="Search records...">
            </div>
            <div class="toolbar-actions">
              <button class="btn btn-outline" @click="exportCSV">Export CSV ↓</button>
              <button class="btn btn-dark" @click="addNew">＋ Add record</button>
            </div>
          </div>

          <div class="panel table-panel">
            <div class="panel-heading">
              <div><h3>{{schema[page].title}}</h3><p>{{rows.length}} record(s)</p></div>
            </div>

            <div class="table-wrap" v-if="rows.length">
              <table>
                <thead>
                  <tr>
                    <th v-for="field in schema[page].fields" :key="field[0]">{{field[1]}}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in rows" :key="row.id">
                    <td v-for="field in schema[page].fields" :key="field[0]">
                      {{fieldValue(field[0],row[field[0]])}}
                    </td>
                    <td class="actions">
                      <button class="mini-btn" @click="edit(row)">Edit</button>
                      <button class="mini-btn danger" @click="remove(row)">Delete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-else class="empty">
              <div class="empty-icon">＋</div>
              <b>No records found</b>
              <p>Add a record or change your search.</p>
              <button class="btn btn-dark" @click="addNew">Add first record</button>
            </div>
          </div>
        </section>

        <section v-else-if="page === 'reports'">
          <div class="panel">
            <div class="panel-heading">
              <div><h3>Transaction report</h3><p>Filter records by date and type</p></div>
              <button class="btn btn-outline" @click="printReport">Print report</button>
            </div>

            <div class="report-filters">
              <label>From date<input type="date" v-model="reportStart"></label>
              <label>To date<input type="date" v-model="reportEnd"></label>
              <label>Type
                <select v-model="reportType">
                  <option value="all">All types</option>
                  <option>Income</option>
                  <option>Expense</option>
                </select>
              </label>
            </div>

            <div class="stats-grid report-stats">
              <div class="stat-card"><div class="stat-label">Income</div><div class="stat-number">{{money(reportTotals.income)}}</div></div>
              <div class="stat-card"><div class="stat-label">Expenses</div><div class="stat-number">{{money(reportTotals.expenses)}}</div></div>
              <div class="stat-card"><div class="stat-label">Net</div><div class="stat-number">{{money(reportTotals.income-reportTotals.expenses)}}</div></div>
            </div>

            <div class="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th class="right">Amount</th></tr></thead>
                <tbody>
                  <tr v-for="row in reportRows" :key="row.id">
                    <td>{{row.date}}</td><td>{{row.description || row.party || '—'}}</td>
                    <td>{{row.category || '—'}}</td><td>{{row.type}}</td>
                    <td class="right">{{money(row.amount)}}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="!reportRows.length" class="empty">No transactions match these filters.</div>
          </div>

          <div class="panel">
            <div class="panel-heading"><div><h3>Other summaries</h3><p>Totals across saved records</p></div></div>
            <div class="record-line"><span>Payroll entries</span><b>{{db.payroll.length}}</b></div>
            <div class="record-line"><span>Payroll paid</span><b>{{money(totals.payroll)}}</b></div>
            <div class="record-line"><span>Crop activities</span><b>{{db.crops.length}}</b></div>
            <div class="record-line"><span>Opening balance entries</span><b>{{db.openingBalances.length}}</b></div>
            <div class="record-line"><span>Employees registered</span><b>{{db.employees.length}}</b></div>
          </div>
        </section>

        <section v-else-if="page === 'backup'">
          <div class="panel">
            <div class="panel-heading">
              <div><h3>Backup and restore</h3><p>Download or restore browser records.</p></div>
            </div>

            <div class="backup-grid">
              <div class="backup-card">
                <span class="backup-icon">↓</span>
                <h3>Export backup</h3>
                <p>Download your records as a JSON file.</p>
                <button class="btn btn-dark" @click="backup">Download backup</button>
              </div>
              <div class="backup-card">
                <span class="backup-icon">↑</span>
                <h3>Restore backup</h3>
                <p>Restore records from a JSON backup.</p>
                <label class="btn btn-outline file-button">
                  Choose backup file
                  <input type="file" accept=".json,application/json" @change="restore" hidden>
                </label>
              </div>
            </div>

            <div class="warning">
              <b>Storage notice</b>
              <p>Data is stored in this browser only. Export backups regularly. This browser version does not provide encrypted native SQLite storage or multi-device synchronization.</p>
            </div>

            <div class="danger-zone">
              <div><h3>Clear browser data</h3><p>Deletes records saved by this app in this browser.</p></div>
              <button class="btn btn-danger" @click="clearAll">Clear all data</button>
            </div>
          </div>
        </section>

        <section v-else-if="page === 'settings'">
          <div class="panel settings-panel">
            <div class="panel-heading">
              <div><h3>Farm settings</h3><p>Choose the name displayed on the dashboard.</p></div>
            </div>
            <form @submit.prevent="save(); message('Settings saved.')">
              <label>Farm / business name
                <input v-model="db.settings.farmName" required>
              </label>
              <button class="btn btn-dark" type="submit">Save settings</button>
            </form>
          </div>
          <div class="panel">
            <h3>About this browser version</h3>
            <p class="muted">NSN Farms ERP browser edition. Data stays in this browser and is not automatically shared across devices.</p>
          </div>
        </section>
      </main>

      <div v-if="showForm" class="modal-backdrop" @click.self="showForm=false">
        <form class="modal" @submit.prevent="submitForm">
          <div class="modal-header">
            <div>
              <div class="eyebrow">NSN FARMS / RECORDS</div>
              <h2>{{editingId ? 'Edit record' : 'Add ' + schema[page].title.toLowerCase()}}</h2>
            </div>
            <button type="button" class="close-btn" @click="showForm=false">×</button>
          </div>

          <div class="form-grid">
            <label v-for="field in schema[page].fields" :key="field[0]">
              {{field[1]}}
              <select v-if="field[2] === 'select'" v-model="form[field[0]]" required>
                <option value="" disabled>Select...</option>
                <option v-for="option in field[3]" :key="option" :value="option">{{option}}</option>
              </select>
              <textarea v-else-if="field[0] === 'notes'" v-model="form[field[0]]" rows="2"></textarea>
              <input v-else v-model="form[field[0]]" :type="field[2]"
                :step="field[2] === 'number' ? 'any' : undefined"
                :required="['date','amount','name','employee'].includes(field[0])">
            </label>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-outline" @click="showForm=false">Cancel</button>
            <button type="submit" class="btn btn-dark">Save record</button>
          </div>
        </form>
      </div>
    </div>
  `
}).mount("#app");

const style = document.createElement("style");

style.textContent = `
:root{font-family:Inter,Arial,sans-serif;color:#202b24;background:#f4f6f2}
*{box-sizing:border-box}
body{margin:0}
button,input,select,textarea{font:inherit}
button{cursor:pointer}
.layout{min-height:100vh}
.sidebar{width:248px;position:fixed;inset:0 auto 0 0;background:#173b2a;color:#eaf1e9;padding:25px 15px;display:flex;flex-direction:column;z-index:2;overflow-y:auto}
.brand{display:flex;align-items:center;gap:11px;padding:0 9px 29px}
.brand-icon{display:grid;place-items:center;width:39px;height:39px;background:#c8ed8b;color:#173b2a;border-radius:12px;font-size:22px;font-weight:900}
.brand b{display:block;font-size:13px;letter-spacing:1.3px}
.brand small{display:block;color:#a8bcae;font-size:11px;margin-top:4px}
.nav-caption{color:#90a797;font-size:10px;letter-spacing:1.6px;font-weight:700;padding:0 12px 10px}
.nav-item{display:flex;align-items:center;gap:12px;width:100%;padding:11px 12px;border:0;border-radius:8px;background:transparent;color:#d0ddd3;text-align:left;margin:2px 0;font-size:13px}
.nav-item:hover,.nav-item.active{background:#2b513b;color:white}
.nav-item.active{box-shadow:inset 3px 0 #c8ed8b}
.nav-icon{width:20px;font-size:17px;text-align:center;color:#c8ed8b}
.sidebar-bottom{margin-top:auto;border-top:1px solid #375844;padding:18px 9px 0;font-size:12px;color:#d8e4da}
.sidebar-bottom small{display:block;color:#a8bcae;padding:7px 0 0 15px}
.status-dot{display:inline-block;width:7px;height:7px;background:#b5e77a;border-radius:50%;margin-right:7px}
.main{margin-left:248px;padding:30px 34px 55px;max-width:1800px}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:24px}
.eyebrow{font-size:10px;letter-spacing:1.4px;font-weight:800;color:#728273}
.topbar h1{font-size:27px;letter-spacing:-.8px;margin:6px 0 0}
.top-actions{display:flex;align-items:center;gap:15px}
.date-label{font-size:12px;color:#6f7b70}
.btn{border-radius:7px;padding:10px 14px;border:1px solid transparent;font-size:12px;font-weight:700;white-space:nowrap}
.btn-dark{background:#1c4430;color:white}
.btn-dark:hover{background:#28583e}
.btn-outline{border-color:#d8ded5;background:white;color:#354438}
.btn-danger{background:#a83232;color:white}
.welcome{background:#204a33;color:white;border-radius:12px;padding:25px 29px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.welcome-tag{font-size:10px;letter-spacing:1.5px;color:#c8ed8b;font-weight:800}
.welcome h2{font-size:23px;margin:10px 0 7px}
.welcome p{color:#c6d7c9;font-size:13px;margin:0}
.welcome-symbol{font-size:80px;color:#8eb878;opacity:.45}
.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}
.stat-card,.panel{background:white;border:1px solid #e7ebe4;border-radius:10px}
.stat-card{padding:18px}
.stat-label{font-size:12px;color:#667467}
.stat-number{font-size:22px;font-weight:750;margin:11px 0 8px;overflow-wrap:anywhere}
.stat-note{font-size:10px;color:#8b958a}
.negative{color:#a83232}
.dashboard-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:18px;margin-bottom:18px}
.panel{padding:20px;margin-bottom:18px;min-width:0}
.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.panel-heading h3{font-size:15px;margin:0}
.panel-heading p{font-size:11px;color:#7c887c;margin:5px 0 0}
.quick-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.quick-grid button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;padding:14px;border:1px solid #e7ebe4;border-radius:8px;background:#fbfcfa;color:#24352a}
.quick-grid button:hover{border-color:#9fbd91;background:#f6faf2}
.quick-grid span{display:grid;place-items:center;background:#eaf3e2;color:#315f38;width:31px;height:31px;border-radius:8px;margin-bottom:10px}
.quick-grid b{font-size:12px}
.quick-grid small{font-size:10px;color:#778478;margin-top:5px}
.record-line{display:flex;justify-content:space-between;gap:10px;padding:13px 0;border-bottom:1px solid #edf0eb;font-size:12px;color:#687568}
.record-line b{color:#25382a}
.full{width:100%;margin-top:15px}
.text-button{border:0;background:transparent;color:#315d3d;font-size:11px;font-weight:700}
.toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}
.searchbox{display:flex;align-items:center;gap:8px;border:1px solid #dce2d9;border-radius:7px;background:white;padding:0 12px;width:min(360px,100%);height:39px}
.searchbox input{border:0;outline:0;width:100%;background:transparent;font-size:12px}
.toolbar-actions{display:flex;gap:8px}
.table-panel{padding-bottom:5px}
.table-wrap{width:100%;overflow:auto}
table{border-collapse:collapse;width:100%;font-size:12px;white-space:nowrap}
th{text-align:left;color:#7a867a;font-size:10px;text-transform:uppercase;letter-spacing:.5px;background:#f8faf7}
th,td{padding:12px 13px;border-bottom:1px solid #edf0eb}
td{color:#344237}
.right{text-align:right}
.actions{display:flex;gap:5px}
.mini-btn{border:1px solid #dce2d9;background:white;border-radius:5px;padding:5px 7px;font-size:10px}
.mini-btn.danger{color:#a83232}
.empty{text-align:center;padding:34px 12px;color:#7b877b;font-size:12px}
.empty b{display:block;color:#354438;margin:8px 0}
.empty p{margin:7px 0 15px}
.empty-icon{font-size:24px;color:#77986a}
.notice{background:#e7f4df;border:1px solid #c8e3b9;color:#315c2e;border-radius:7px;padding:11px 14px;margin-bottom:16px;font-size:12px}
.report-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:20px 0}
.report-filters label,.settings-panel label,.form-grid label{display:flex;flex-direction:column;gap:7px;font-size:11px;font-weight:700;color:#5d6b5e}
.report-filters input,.report-filters select,.settings-panel input,.form-grid input,.form-grid select,.form-grid textarea{width:100%;min-width:0;border:1px solid #dce2d9;border-radius:6px;background:white;padding:10px;font-size:12px;color:#29372c}
.report-stats{grid-template-columns:repeat(3,minmax(0,1fr));margin:18px 0}
.backup-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}
.backup-card{padding:18px;border:1px solid #e4e9e1;border-radius:9px}
.backup-icon{font-size:22px;color:#416b40}
.backup-card h3{font-size:14px}
.backup-card p,.muted{font-size:12px;color:#758175;line-height:1.6}
.file-button{display:inline-block;cursor:pointer}
.warning{background:#fff7e7;border:1px solid #f0e1bb;border-radius:8px;padding:15px;margin-top:20px}
.warning b{font-size:12px;color:#765b21}
.warning p{font-size:11px;color:#786943;line-height:1.7;margin-bottom:0}
.danger-zone{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-top:24px;padding-top:20px;border-top:1px solid #e8ece6}
.danger-zone h3{font-size:13px;margin:0}
.danger-zone p{font-size:11px;color:#788478}
.settings-panel form{max-width:450px;display:grid;gap:15px}
.settings-panel form button{justify-self:start}
.modal-backdrop{position:fixed;inset:0;background:#13251db3;z-index:5;display:grid;place-items:center;padding:20px;overflow:auto}
.modal{width:min(650px,100%);background:white;border-radius:12px;padding:24px;max-height:92vh;overflow:auto}
.modal-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}
.modal-header h2{font-size:20px;margin:6px 0}
.close-btn{border:0;background:#f0f3ee;border-radius:7px;width:32px;height:32px;font-size:22px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:24px}
@media(max-width:1100px){.sidebar{width:215px}.main{margin-left:215px;padding:24px 20px}.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dashboard-grid{grid-template-columns:1fr}}
@media(max-width:700px){.sidebar{position:static;width:auto;padding:12px;display:block}.brand{padding:3px 5px 12px}.nav-caption,.sidebar-bottom{display:none}.sidebar .nav-item{display:inline-flex;width:auto;padding:9px;font-size:11px;margin:2px}.nav-icon{width:auto}.main{margin-left:0;padding:18px 12px}.topbar{align-items:flex-start}.topbar h1{font-size:22px}.top-actions{flex-direction:column;align-items:flex-end;gap:8px}.date-label{display:none}.welcome{padding:20px}.welcome h2{font-size:19px}.welcome-symbol{font-size:50px}.stats-grid{gap:9px}.stat-card{padding:13px}.stat-number{font-size:18px}.panel{padding:14px}.toolbar{align-items:stretch;flex-direction:column}.searchbox{width:100%}.toolbar-actions{justify-content:flex-end;flex-wrap:wrap}.report-filters,.backup-grid,.form-grid{grid-template-columns:1fr}.modal{padding:18px}.report-stats{grid-template-columns:1fr}.danger-zone{align-items:flex-start;flex-direction:column}}
@media print{.sidebar,.topbar,.toolbar,.btn,.text-button{display:none!important}.main{margin:0;padding:0}.panel{border:0}.layout{background:white}}
`;

document.head.appendChild(style);
