
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Company = require("../models/Company");
const User = require("../models/User");
const { ROLES } = require("../config/roles");

const assignableRoles = [
  ROLES.PROCUREMENT_MANAGER,
  ROLES.REQUESTER,
  ROLES.APPROVER,
  ROLES.FINANCE,
  ROLES.AUDITOR,
];

function memberView(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

function validEmail(email) {
  return (
    typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

exports.createCompany = async (req, res, next) => {
  try {
    const { name, legalName, email, phone, address, industry } =
      req.body || {};

    if (typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Company name must contain at least 2 characters.",
      });
    }

    if (email && !validEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid company email address.",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account was not found.",
      });
    }

    if (user.companyId) {
      return res.status(409).json({
        success: false,
        message: "You already belong to a company workspace.",
      });
    }

    const company = await Company.create({
      name: name.trim(),
      legalName,
      email: email ? email.trim().toLowerCase() : "",
      phone,
      address,
      industry,
      createdBy: user._id,
    });

    user.companyId = company._id;
    user.role = ROLES.COMPANY_ADMIN;
    await user.save();

    return res.status(201).json({
      success: true,
      message: "Company workspace created successfully.",
      company,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: company._id.toString(),
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getCompany = async (req, res, next) => {
  try {
    const company = await Company.findOne({
      _id: req.user.companyId,
      status: "active",
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Active company workspace not found.",
      });
    }

    return res.json({ success: true, company });
  } catch (error) {
    next(error);
  }
};

exports.updateCompany = async (req, res, next) => {
  try {
    const allowedFields = [
      "name",
      "legalName",
      "email",
      "phone",
      "address",
      "industry",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body?.[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (
      updates.name !== undefined &&
      (typeof updates.name !== "string" || updates.name.trim().length < 2)
    ) {
      return res.status(400).json({
        success: false,
        message: "Company name must contain at least 2 characters.",
      });
    }

    if (updates.name) updates.name = updates.name.trim();

    if (updates.email) {
      if (!validEmail(updates.email)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid company email address.",
        });
      }
      updates.email = updates.email.trim().toLowerCase();
    }

    for (const field of ["legalName", "phone", "address", "industry"]) {
      if (updates[field] !== undefined && typeof updates[field] !== "string") {
        return res.status(400).json({
          success: false,
          message: `${field} must be text.`,
        });
      }
      if (typeof updates[field] === "string") {
        updates[field] = updates[field].trim();
      }
    }

    const company = await Company.findOneAndUpdate(
      { _id: req.user.companyId, status: "active" },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company workspace not found.",
      });
    }

    return res.json({
      success: true,
      message: "Company details updated.",
      company,
    });
  } catch (error) {
    next(error);
  }
};

exports.listMembers = async (req, res, next) => {
  try {
    const members = await User.find({ companyId: req.user.companyId })
      .select("name email role status createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      members: members.map(memberView),
    });
  } catch (error) {
    next(error);
  }
};

exports.createMember = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};

    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
      return res.status(400).json({
        success: false,
        message: "Name must contain 2–80 characters.",
      });
    }

    if (!validEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must contain 8–72 characters.",
      });
    }

    if (!assignableRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Select a valid team member role.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail }).select("_id");

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const member = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
      companyId: req.user.companyId,
      status: "active",
    });

    return res.status(201).json({
      success: true,
      message: "Team member created successfully.",
      member: memberView(member),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    next(error);
  }
};

exports.updateMemberRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body || {};

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (!assignableRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Select a valid team member role.",
      });
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role here.",
      });
    }

    const member = await User.findOne({
      _id: userId,
      companyId: req.user.companyId,
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Team member not found in your company.",
      });
    }

    if (member.role === ROLES.COMPANY_ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Company administrator roles cannot be reassigned here.",
      });
    }

    member.role = role;
    await member.save();

    return res.json({
      success: true,
      message: "Member role updated.",
      member: memberView(member),
    });
  } catch (error) {
    next(error);
  }
};

exports.updateMemberStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status } = req.body || {};

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or disabled.",
      });
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own account status.",
      });
    }

    const member = await User.findOne({
      _id: userId,
      companyId: req.user.companyId,
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Team member not found in your company.",
      });
    }

    if (member.role === ROLES.COMPANY_ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Company administrator accounts cannot be disabled here.",
      });
    }

    member.status = status;
    await member.save();

    return res.json({
      success: true,
      message: `Member ${status === "active" ? "enabled" : "disabled"}.`,
      member: memberView(member),
    });
  } catch (error) {
    next(error);
  }
};
