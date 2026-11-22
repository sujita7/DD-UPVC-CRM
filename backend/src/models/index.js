import { MySQLModel } from "./mysqlModel.js";
import { AdminMySQLModel } from "./mysqlAdmin.js";
import { createModel } from "./modelFactory.js";

// Central model registry powered by MySQL
export const Admin = createModel(new AdminMySQLModel());
export const Employee = createModel(new MySQLModel("employees"));
export const Attendance = createModel(new MySQLModel("attendances"));
export const Payroll = createModel(new MySQLModel("payrolls"));
export const Customer = createModel(new MySQLModel("customers"));
export const Supplier = createModel(new MySQLModel("suppliers"));
export const Payment = createModel(new MySQLModel("payments"));
export const Invoice = createModel(new MySQLModel("invoices"));
export const Quotation = createModel(new MySQLModel("quotations"));
export const Holiday = createModel(new MySQLModel("holidays"));
export const Task = createModel(new MySQLModel("tasks"));
export const SalesOrder = createModel(new MySQLModel("sales_orders"));
export const Product = createModel(new MySQLModel("products"));
export const Expense = createModel(new MySQLModel("expenses"));
export const AdvancePayment = createModel(new MySQLModel("advance_payments"));
export const CompanySettings = createModel(new MySQLModel("company_settings", ["bankDetails"]));

export default {
  Admin,
  Employee,
  Attendance,
  Payroll,
  Customer,
  Supplier,
  Payment,
  Invoice,
  Quotation,
  Holiday,
  Task,
  SalesOrder,
  Product,
  Expense,
  AdvancePayment,
  CompanySettings,
};
