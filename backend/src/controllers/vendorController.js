
const mongoose = require("mongoose");
const Vendor = require("../models/Vendor");

const MANAGE_ROLES = [
  "company_admin",
  "procurement_manager",
];

function getUserId(req) {
  return req.user?._id || req.user?.id || req.user?.userId;
}

function getCompanyId(req) {
  return req.user?.companyId?._id || req.user?.companyId;
}

function isAuthorized(req, res) {
  if (!MANAGE_ROLES.includes(req.user?.role)) {
    res.status(403).json({
      success: false,
      message: "You are not allowed to manage vendors.",
    });
    return false;
  }

  return true;
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function validateVendorInput(body, isUpdate = false) {
  const errors = [];
  const requiredFields = ["name", "email", "phone", "category"];

  if (!isUpdate) {
    for (const field of requiredFields) {
      if (!String(body[field] || "").trim()) {
        errors.push(`${field} is required.`);
      }
    }
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2 || name.length > 150) {
      errors.push("Vendor name must contain 2 to 150 characters.");
    }
  }

  if (body.email !== undefined) {
    const email = String(body.email).trim();
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      errors.push("Enter a valid email address.");
    }
  }

  if (body.phone !== undefined) {
    const phone = String(body.phone).trim();
    if (phone.length < 7 || phone.length > 30) {
      errors.push("Phone number must contain 7 to 30 characters.");
    }
  }

  if (body.category !== undefined && !String(body.category).trim()) {
    errors.push("Category cannot be empty.");
  }

  if (
    body.paymentTerms !== undefined &&
    !["immediate", "net_15", "net_30", "net_45", "net_60"].includes(
      body.paymentTerms
    )
  ) {
    errors.push("Invalid payment terms.");
  }

  if (
    body.status !== undefined &&
    !["active", "inactive"].includes(body.status)
  ) {
    errors.push("Status must be active or inactive.");
  }

  return errors;
}

function pickVendorFields(body) {
  const allowed = [
    "name",
    "contactPerson",
    "email",
    "phone",
    "website",
    "category",
    "taxId",
    "paymentTerms",
    "notes",
  ];

  const data = {};

  for (const field of allowed) {
    if (body[field] !== undefined) {
      data[field] =
        typeof body[field] === "string"
          ? body[field].trim()
          : body[field];
    }
  }

  if (body.address !== undefined) {
    const address = body.address;

    if (!address || typeof address !== "object" || Array.isArray(address)) {
      throw new Error("Address must be an object.");
    }

    const allowedAddressFields = [
      "street",
      "city",
      "state",
      "postalCode",
      "country",
    ];

    const cleanAddress = {};

    for (const field of allowedAddressFields) {
      if (address[field] !== undefined) {
        cleanAddress[field] = String(address[field]).trim();
      }
    }

    data.address = cleanAddress;
  }

  return data;
}

async function createVendor(req, res, next) {
  try {
    if (!isAuthorized(req, res)) return;

    const errors = validateVendorInput(req.body);
    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    const company = getCompanyId(req);
    const creator = getUserId(req);

    if (!company || !creator) {
      return res.status(400).json({
        success: false,
        message: "User company or identity is missing.",
      });
    }

    const email = String(req.body.email).trim().toLowerCase();

    const existing = await Vendor.findOne({
      companyId: company,
      email,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A vendor with this email already exists.",
      });
    }

    const data = pickVendorFields(req.body);

    const vendor = await Vendor.create({
      ...data,
      companyId: company,
      email,
      createdBy: creator,
    });

    return res.status(201).json({
      success: true,
      message: "Vendor created successfully.",
      vendor,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A vendor with this email already exists.",
      });
    }

    if (error.message === "Address must be an object.") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
}

async function listVendors(req, res, next) {
  try {
    if (!isAuthorized(req, res)) return;

    const filter = { companyId: getCompanyId(req) };

    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const category = String(req.query.category || "").trim();

    if (status && !["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status filter.",
      });
    }

    if (status) filter.status = status;
    if (category) filter.category = category;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");

      filter.$or = [
        { name: regex },
        { email: regex },
        { contactPerson: regex },
        { vendorCode: regex },
        { category: regex },
      ];
    }

    const vendors = await Vendor.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return res.json({
      success: true,
      count: vendors.length,
      vendors,
    });
  } catch (error) {
    return next(error);
  }
}

async function getVendor(req, res, next) {
  try {
    if (!isAuthorized(req, res)) return;

    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID.",
      });
    }

    const vendor = await Vendor.findOne({
      _id: req.params.id,
      companyId: getCompanyId(req),
    }).lean();

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found.",
      });
    }

    return res.json({ success: true, vendor });
  } catch (error) {
    return next(error);
  }
}

async function updateVendor(req, res, next) {
  try {
    if (!isAuthorized(req, res)) return;

    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID.",
      });
    }

    const errors = validateVendorInput(req.body, true);
    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    const data = pickVendorFields(req.body);

    if (req.body.status !== undefined) {
      data.status = req.body.status;
    }

    if (data.email !== undefined) {
      data.email = String(data.email).toLowerCase();

      const duplicate = await Vendor.findOne({
        companyId: getCompanyId(req),
        email: data.email,
        _id: { $ne: req.params.id },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Another vendor already uses this email.",
        });
      }
    }

    data.updatedBy = getUserId(req);

    const vendor = await Vendor.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: getCompanyId(req),
      },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found.",
      });
    }

    return res.json({
      success: true,
      message: "Vendor updated successfully.",
      vendor,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Another vendor already uses this email.",
      });
    }

    if (error.message === "Address must be an object.") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
}

async function updateVendorStatus(req, res, next) {
  try {
    if (!isAuthorized(req, res)) return;

    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID.",
      });
    }

    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or inactive.",
      });
    }

    const vendor = await Vendor.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: getCompanyId(req),
      },
      {
        $set: {
          status,
          updatedBy: getUserId(req),
        },
      },
      { new: true, runValidators: true }
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found.",
      });
    }

    return res.json({
      success: true,
      message: `Vendor ${status === "active" ? "activated" : "deactivated"} successfully.`,
      vendor,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createVendor,
  listVendors,
  getVendor,
  updateVendor,
  updateVendorStatus,
};
