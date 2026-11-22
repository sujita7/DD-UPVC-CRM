import { v4 as uuidv4 } from "uuid";
import { getMySQLPool } from "../config/db.js";

/**
 * Universal MySQL Model Engine
 * Exposes full Mongoose-compatible API backed 100% by MySQL relational tables.
 */

// Known JSON-serialized columns across the schema
const JSON_COLUMNS = new Set([
  "permissions", "refreshTokens", "salary", "bankDetails", "address",
  "documents", "emergencyContact", "billingAddress", "shippingAddress",
  "contactPerson", "tags", "customerSnapshot", "items", "payments",
  "receipt", "leaveDetails", "payPeriod", "attendance", "earnings", "deductions",
  "rawMaterials", "specifications"
]);

// In-memory cache of valid column names for each MySQL table
const tableColumnsCache = new Map();

export class MySQLModel {
  constructor(tableName, jsonCols = []) {
    this.tableName = tableName;
    this.jsonColumns = new Set([...JSON_COLUMNS, ...jsonCols]);
  }

  get pool() {
    return getMySQLPool();
  }

  async _getColumns() {
    if (tableColumnsCache.has(this.tableName)) {
      return tableColumnsCache.get(this.tableName);
    }
    try {
      const [rows] = await this.pool.query(`SHOW COLUMNS FROM \`${this.tableName}\``);
      const cols = new Set(rows.map(r => r.Field));
      tableColumnsCache.set(this.tableName, cols);
      return cols;
    } catch (e) {
      return null;
    }
  }

  // Parses row from MySQL to JS object
  _parseRow(row) {
    if (!row) return null;
    const obj = { ...row };
    // Provide both _id and id for 100% frontend compatibility
    obj._id = obj.id;

    for (const key of Object.keys(obj)) {
      if (this.jsonColumns.has(key) && typeof obj[key] === "string") {
        try {
          obj[key] = JSON.parse(obj[key]);
        } catch (e) {
          // keep as string if not valid JSON
        }
      }
    }
    return obj;
  }

  // Prepares JS object for MySQL insertion/update
  async _serializeRow(data) {
    const validCols = await this._getColumns();
    const row = {};

    // Standard fallback mapping
    const enriched = { ...data };
    if (!enriched.name && enriched.companyName) {
      enriched.name = enriched.companyName;
    }
    if (enriched.payPeriod?.month !== undefined && enriched.month === undefined) {
      enriched.month = Number(enriched.payPeriod.month);
    }
    if (enriched.payPeriod?.year !== undefined && enriched.year === undefined) {
      enriched.year = Number(enriched.payPeriod.year);
    }

    for (const [key, value] of Object.entries(enriched)) {
      if (typeof value === "function") continue;
      if (key === "_id") {
        if (!row.id) row.id = String(value);
        continue;
      }
      if (value === undefined) continue;

      // Ensure key exists in table schema (if cache available)
      if (validCols && !validCols.has(key)) {
        continue;
      }

      if (this.jsonColumns.has(key)) {
        if (value === null) {
          row[key] = null;
        } else if (typeof value === "object") {
          row[key] = JSON.stringify(value);
        } else {
          row[key] = String(value);
        }
      } else if (value instanceof Date) {
        row[key] = value.toISOString().slice(0, 19).replace("T", " ");
      } else {
        row[key] = value;
      }
    }
    return row;
  }

  // Convert Mongo-style filter to SQL WHERE clause
  _buildWhere(filter = {}, validCols = null) {
    const conditions = [];
    const params = [];

    const parseCondition = (rawKey, val) => {
      let col = rawKey === "_id" ? "id" : rawKey;

      // Handle dotted paths like "payPeriod.month"
      let isJsonExtract = false;
      if (col.includes(".")) {
        const parts = col.split(".");
        if (col === "payPeriod.month" && validCols && validCols.has("month")) {
          col = "month";
        } else if (col === "payPeriod.year" && validCols && validCols.has("year")) {
          col = "year";
        } else if (validCols && validCols.has(parts[0])) {
          col = `JSON_UNQUOTE(JSON_EXTRACT(\`${parts[0]}\`, '$.${parts.slice(1).join(".")}'))`;
          isJsonExtract = true;
        } else if (validCols && validCols.has(parts[1])) {
          col = parts[1];
        } else {
          col = parts[0];
        }
      }

      // Check if column exists
      if (validCols && !isJsonExtract && !validCols.has(col)) {
        return null;
      }

      const colRef = isJsonExtract ? col : `\`${col}\``;

      if (val === null || val === undefined) {
        return `${colRef} IS NULL`;
      }

      if (typeof val === "object" && !(val instanceof Date)) {
        // Regex search
        if (val.$regex !== undefined) {
          params.push(`%${val.$regex}%`);
          return `${colRef} LIKE ?`;
        }
        // Operators: $gte, $lte, $gt, $lt, $ne, $in
        const ops = [];
        if (val.$gte !== undefined) {
          params.push(val.$gte instanceof Date ? val.$gte.toISOString().slice(0, 19).replace("T", " ") : val.$gte);
          ops.push(`${colRef} >= ?`);
        }
        if (val.$lte !== undefined) {
          params.push(val.$lte instanceof Date ? val.$lte.toISOString().slice(0, 19).replace("T", " ") : val.$lte);
          ops.push(`${colRef} <= ?`);
        }
        if (val.$gt !== undefined) {
          params.push(val.$gt instanceof Date ? val.$gt.toISOString().slice(0, 19).replace("T", " ") : val.$gt);
          ops.push(`${colRef} > ?`);
        }
        if (val.$lt !== undefined) {
          params.push(val.$lt instanceof Date ? val.$lt.toISOString().slice(0, 19).replace("T", " ") : val.$lt);
          ops.push(`${colRef} < ?`);
        }
        if (val.$ne !== undefined) {
          params.push(val.$ne);
          ops.push(`${colRef} != ?`);
        }
        if (Array.isArray(val.$in) && val.$in.length > 0) {
          const placeholders = val.$in.map(() => "?").join(", ");
          params.push(...val.$in);
          ops.push(`${colRef} IN (${placeholders})`);
        }
        if (ops.length > 0) {
          return ops.join(" AND ");
        }
      }

      // Simple equality
      if (val instanceof Date) {
        params.push(val.toISOString().slice(0, 19).replace("T", " "));
        return `${colRef} = ?`;
      }

      params.push(val);
      return `${colRef} = ?`;
    };

    for (const [k, v] of Object.entries(filter)) {
      if (k === "$or" && Array.isArray(v)) {
        const orClauses = [];
        for (const subFilter of v) {
          const subConds = [];
          for (const [subK, subV] of Object.entries(subFilter)) {
            const cond = parseCondition(subK, subV);
            if (cond) subConds.push(cond);
          }
          if (subConds.length > 0) {
            orClauses.push(`(${subConds.join(" AND ")})`);
          }
        }
        if (orClauses.length > 0) {
          conditions.push(`(${orClauses.join(" OR ")})`);
        }
      } else {
        const cond = parseCondition(k, v);
        if (cond) conditions.push(cond);
      }
    }

    const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return { whereSQL, params };
  }

  // Create an instance
  createInstance(data = {}) {
    const self = this;
    const instance = { ...data };
    instance.id = instance.id || instance._id || uuidv4();
    instance._id = instance.id;

    instance.save = async function () {
      const serialized = await self._serializeRow(this);
      const cols = Object.keys(serialized);
      const vals = Object.values(serialized);
      const placeholders = cols.map(() => "?").join(", ");
      const updates = cols.filter(c => c !== "id").map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(", ");

      const sql = `
        INSERT INTO \`${self.tableName}\` (${cols.map(c => `\`${c}\``).join(", ")})
        VALUES (${placeholders})
        ON DUPLICATE KEY UPDATE ${updates || `id=id`}
      `;
      await self.pool.query(sql, vals);
      return self._parseRow(this);
    };

    instance.deleteOne = async function () {
      await self.pool.query(`DELETE FROM \`${self.tableName}\` WHERE id = ?`, [this.id]);
      return { deletedCount: 1 };
    };

    return instance;
  }

  // Create single record
  async create(data) {
    const inst = this.createInstance(data);
    await inst.save();
    return inst;
  }

  // Query Builder for .find(), .findOne(), etc.
  _createQueryChain(filter, isSingle = false) {
    const self = this;
    const state = {
      filter: filter || {},
      sort: null,
      skip: 0,
      limit: isSingle ? 1 : 0,
      populates: [],
      selectFields: null
    };

    const chain = {
      sort(sortObj) {
        state.sort = sortObj;
        return chain;
      },
      skip(n) {
        state.skip = Number(n) || 0;
        return chain;
      },
      limit(n) {
        state.limit = Number(n) || 0;
        return chain;
      },
      lean() {
        return chain;
      },
      select(fields) {
        state.selectFields = fields;
        return chain;
      },
      populate(path, select) {
        if (typeof path === "string") {
          const parts = path.trim().split(/\s+/);
          for (const p of parts) {
            state.populates.push({ path: p, select });
          }
        }
        return chain;
      },
      async exec() {
        return await self._executeChain(state, isSingle);
      },
      then(resolve, reject) {
        return this.exec().then(resolve, reject);
      },
      catch(reject) {
        return this.exec().catch(reject);
      }
    };

    return chain;
  }

  async _executeChain(state, isSingle) {
    const validCols = await this._getColumns();
    const { whereSQL, params } = this._buildWhere(state.filter, validCols);
    let sql = `SELECT * FROM \`${this.tableName}\` ${whereSQL}`;

    if (state.sort) {
      const orderParts = [];
      if (typeof state.sort === "string") {
        const parts = state.sort.trim().split(/\s+/);
        for (let p of parts) {
          const desc = p.startsWith("-");
          const field = desc ? p.slice(1) : p;
          const col = field === "_id" ? "id" : field;
          if (!validCols || validCols.has(col)) {
            orderParts.push(`\`${col}\` ${desc ? "DESC" : "ASC"}`);
          }
        }
      } else if (typeof state.sort === "object") {
        for (const [k, v] of Object.entries(state.sort)) {
          const col = k === "_id" ? "id" : k;
          if (!validCols || validCols.has(col)) {
            orderParts.push(`\`${col}\` ${Number(v) === -1 ? "DESC" : "ASC"}`);
          }
        }
      }
      if (orderParts.length > 0) {
        sql += ` ORDER BY ${orderParts.join(", ")}`;
      }
    }

    if (state.limit > 0) {
      sql += ` LIMIT ${state.limit}`;
      if (state.skip > 0) {
        sql += ` OFFSET ${state.skip}`;
      }
    } else if (state.skip > 0) {
      sql += ` LIMIT 18446744073709551615 OFFSET ${state.skip}`;
    }

    const [rows] = await this.pool.query(sql, params);

    let parsed = rows.map(r => this._parseRow(r));

    // Handle .populate()
    if (state.populates.length > 0 && parsed.length > 0) {
      for (const pop of state.populates) {
        await this._populateRows(parsed, pop.path, pop.select);
      }
    }

    if (isSingle) {
      return parsed.length > 0 ? this.createInstance(parsed[0]) : null;
    }
    return parsed.map(p => this.createInstance(p));
  }

  async _populateRows(rows, pathKey, selectFields) {
    const refTableMap = {
      employee: "employees",
      customer: "customers",
      supplier: "suppliers",
      createdBy: "admins",
      approvedBy: "admins",
      quotation: "quotations",
      invoice: "invoices"
    };

    const targetTable = refTableMap[pathKey];
    if (!targetTable) return;

    const idsToFetch = [...new Set(rows.map(r => r[pathKey]).filter(id => id && typeof id === "string"))];
    if (idsToFetch.length === 0) return;

    const placeholders = idsToFetch.map(() => "?").join(", ");
    const [fetched] = await this.pool.query(
      `SELECT * FROM \`${targetTable}\` WHERE id IN (${placeholders})`,
      idsToFetch
    );

    const refMap = {};
    for (const item of fetched) {
      const parsedItem = { ...item, _id: item.id };
      for (const k of Object.keys(parsedItem)) {
        if (JSON_COLUMNS.has(k) && typeof parsedItem[k] === "string") {
          try { parsedItem[k] = JSON.parse(parsedItem[k]); } catch (e) {}
        }
      }
      refMap[item.id] = parsedItem;
    }

    for (const r of rows) {
      if (r[pathKey] && refMap[r[pathKey]]) {
        r[pathKey] = refMap[r[pathKey]];
      }
    }
  }

  find(filter) {
    return this._createQueryChain(filter, false);
  }

  findOne(filter) {
    return this._createQueryChain(filter, true);
  }

  findById(id) {
    return this._createQueryChain({ id }, true);
  }

  findByIdAndUpdate(id, updateData, options = { new: true }) {
    const execute = async () => {
      const actualId = String(id);
      const existing = await this.findById(actualId);
      if (!existing) return null;

      // Handle $set operator or raw updates
      const updates = updateData.$set ? { ...updateData.$set } : { ...updateData };
      delete updates.$set;
      delete updates._id;

      const serialized = await this._serializeRow(updates);
      const cols = Object.keys(serialized);
      if (cols.length > 0) {
        const setSQL = cols.map(c => `\`${c}\` = ?`).join(", ");
        const vals = [...Object.values(serialized), actualId];
        await this.pool.query(`UPDATE \`${this.tableName}\` SET ${setSQL} WHERE id = ?`, vals);
      }

      return options.new ? await this.findById(actualId) : existing;
    };

    const promise = execute();
    promise.lean = () => promise;
    promise.populate = () => promise;
    promise.select = () => promise;
    promise.exec = () => promise;
    return promise;
  }

  async findByIdAndDelete(id) {
    const existing = await this.findById(id);
    if (existing) {
      await this.pool.query(`DELETE FROM \`${this.tableName}\` WHERE id = ?`, [String(id)]);
    }
    return existing;
  }

  async deleteOne(filter) {
    const validCols = await this._getColumns();
    const { whereSQL, params } = this._buildWhere(filter, validCols);
    if (!whereSQL) return { deletedCount: 0 };
    const [res] = await this.pool.query(`DELETE FROM \`${this.tableName}\` ${whereSQL} LIMIT 1`, params);
    return { deletedCount: res.affectedRows };
  }

  async deleteMany(filter) {
    const validCols = await this._getColumns();
    const { whereSQL, params } = this._buildWhere(filter, validCols);
    const [res] = await this.pool.query(`DELETE FROM \`${this.tableName}\` ${whereSQL}`, params);
    return { deletedCount: res.affectedRows };
  }

  async countDocuments(filter = {}) {
    const validCols = await this._getColumns();
    const { whereSQL, params } = this._buildWhere(filter, validCols);
    const [rows] = await this.pool.query(`SELECT COUNT(*) AS total FROM \`${this.tableName}\` ${whereSQL}`, params);
    return Number(rows[0]?.total || 0);
  }

  // Dynamic Aggregation for dashboard & reporting queries
  async aggregate(pipeline = []) {
    let matchFilter = {};
    let groupStage = null;

    for (const stage of pipeline) {
      if (stage.$match) {
        matchFilter = { ...matchFilter, ...stage.$match };
      }
      if (stage.$group) {
        groupStage = stage.$group;
      }
    }

    const validCols = await this._getColumns();
    const { whereSQL, params } = this._buildWhere(matchFilter, validCols);

    if (groupStage) {
      const selectParts = [];
      let groupByCol = null;

      if (groupStage._id && typeof groupStage._id === "string" && groupStage._id.startsWith("$")) {
        let field = groupStage._id.slice(1);
        if (validCols && !validCols.has(field)) {
          if (field === "paymentStatus" && validCols.has("status")) field = "status";
          else if (field === "status" && validCols.has("paymentStatus")) field = "paymentStatus";
          else if (field === "grandTotal" && validCols.has("totalAmount")) field = "totalAmount";
        }
        if (validCols && validCols.has(field)) {
          groupByCol = field;
          selectParts.push(`\`${groupByCol}\` AS \`_id\``);
        } else {
          selectParts.push(`NULL AS \`_id\``);
        }
      } else {
        selectParts.push(`NULL AS \`_id\``);
      }

      for (const [outKey, expr] of Object.entries(groupStage)) {
        if (outKey === "_id") continue;
        if (expr.$sum) {
          if (expr.$sum === 1) {
            selectParts.push(`COUNT(*) AS \`${outKey}\``);
          } else if (typeof expr.$sum === "string" && expr.$sum.startsWith("$")) {
            let sumCol = expr.$sum.slice(1);
            if (validCols && !validCols.has(sumCol)) {
              if (sumCol === "grandTotal" && validCols.has("totalAmount")) sumCol = "totalAmount";
              else if (sumCol === "totalAmount" && validCols.has("grandTotal")) sumCol = "grandTotal";
              else if (sumCol === "amount" && validCols.has("totalAmount")) sumCol = "totalAmount";
            }
            if (validCols && validCols.has(sumCol)) {
              selectParts.push(`COALESCE(SUM(\`${sumCol}\`), 0) AS \`${outKey}\``);
            } else {
              selectParts.push(`0 AS \`${outKey}\``);
            }
          } else {
            selectParts.push(`COUNT(*) AS \`${outKey}\``);
          }
        }
      }

      const groupBySQL = groupByCol ? `GROUP BY \`${groupByCol}\`` : "";
      const sql = `SELECT ${selectParts.join(", ")} FROM \`${this.tableName}\` ${whereSQL} ${groupBySQL}`;
      const [rows] = await this.pool.query(sql, params);
      return rows.map(r => {
        const rowObj = { ...r };
        for (const [k, v] of Object.entries(rowObj)) {
          if (!isNaN(v) && v !== null && k !== "_id") rowObj[k] = Number(v);
        }
        return rowObj;
      });
    }

    // Default match-only return
    const [rows] = await this.pool.query(`SELECT * FROM \`${this.tableName}\` ${whereSQL}`, params);
    return rows.map(r => this._parseRow(r));
  }
}
