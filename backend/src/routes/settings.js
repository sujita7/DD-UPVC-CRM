import { Router } from "express";
import { CompanySettings } from "../models/index.js";

const router = Router();

export const DEFAULT_COMPANY_SETTINGS = {
  id: "default-settings",
  companyLegalName: "DD UPVC WINDOW SYSTEMS",
  displayName: "DD UPVC",
  companyTitle: "DD UPVC WINDOWS",
  address: "Kudri(Medical College Road), Shahdol, M.P.",
  city: "Shahdol",
  state: "Madhya Pradesh",
  pincode: "484001",
  phone: "+91 9826414729",
  email: "ddupvcwindowsystem@gmail.com",
  businessEmail: "ddupvcwindowsystem@gmail.com",
  gstin: "23EVFPG6600A1ZB",
  invoicePrefix: "INV-",
  quotationPrefix: "QT-",
  proformaPrefix: "PI-",
  financialYear: "2026–27",
  whatsappSender: "+91 9826414729",
  bankDetails: [
    {
      id: "bank-1",
      bankName: "State Bank of India (SBI)",
      accountHolder: "DD UPVC WINDOW SYSTEMS",
      accountNumber: "44250720832",
      ifscCode: "SBIN0061553",
      branch: "Medical College Shahdol M.P.",
      isDefault: true,
    },
  ],
  termsAndConditions:
    "1. Installation work will be carried out on FOR basis as per finalized scope.\n2. Total project duration shall be 25 to 35 working days, starting after advance payment.\n3. 50% advance, 30% after dispatch (before unloading), and 20% after installation is mandatory.\n4. All payments must be cleared as per schedule to ensure smooth and timely execution.",
};

// GET /api/settings - Fetch company profile, GSTIN, prefixes and multiple bank details
router.get("/api/settings", async (req, res, next) => {
  try {
    const list = await CompanySettings.find({}).lean();
    let settings = list && list.length > 0 ? list[0] : null;

    if (!settings) {
      settings = await CompanySettings.create(DEFAULT_COMPANY_SETTINGS);
    }

    if (typeof settings.bankDetails === "string") {
      try {
        settings.bankDetails = JSON.parse(settings.bankDetails);
      } catch (e) {
        settings.bankDetails = DEFAULT_COMPANY_SETTINGS.bankDetails;
      }
    }

    if (!Array.isArray(settings.bankDetails) || settings.bankDetails.length === 0) {
      settings.bankDetails = DEFAULT_COMPANY_SETTINGS.bankDetails;
    }

    return res.json({
      ok: true,
      settings,
    });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/settings - Update company profile, GSTIN, prefixes and bank accounts
router.put("/api/settings", async (req, res, next) => {
  try {
    const list = await CompanySettings.find({}).lean();
    const existing = list && list.length > 0 ? list[0] : null;

    const data = { ...req.body };
    delete data._id;

    let updated;
    if (existing && (existing.id || existing._id)) {
      const targetId = existing.id || existing._id;
      updated = await CompanySettings.findByIdAndUpdate(targetId, data, { new: true });
    } else {
      updated = await CompanySettings.create({
        ...DEFAULT_COMPANY_SETTINGS,
        ...data,
      });
    }

    if (typeof updated.bankDetails === "string") {
      try {
        updated.bankDetails = JSON.parse(updated.bankDetails);
      } catch (e) {}
    }

    return res.json({
      ok: true,
      message: "Settings and bank accounts saved successfully.",
      settings: updated,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

