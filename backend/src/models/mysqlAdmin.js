import bcrypt from "bcryptjs";
import { MySQLModel } from "./mysqlModel.js";

export class AdminMySQLModel extends MySQLModel {
  constructor() {
    super("admins", ["permissions", "refreshTokens"]);
  }

  createInstance(data = {}) {
    const instance = super.createInstance(data);

    // Attach Admin helper methods
    instance.comparePassword = async function (candidatePassword) {
      if (!this.password || !candidatePassword) return false;
      return bcrypt.compare(candidatePassword, this.password);
    };

    instance.passwordChangedAfter = function (jwtIssuedAt) {
      if (this.passwordChangedAt) {
        const changedTime = parseInt(new Date(this.passwordChangedAt).getTime() / 1000, 10);
        return jwtIssuedAt < changedTime;
      }
      return false;
    };

    instance.toPublic = function () {
      const obj = { ...this };
      delete obj.password;
      delete obj.refreshTokens;
      delete obj.passwordResetToken;
      delete obj.passwordResetExpires;
      delete obj.save;
      delete obj.comparePassword;
      delete obj.passwordChangedAfter;
      delete obj.toPublic;
      return obj;
    };

    // Auto-hash password on save if not already hashed
    const originalSave = instance.save.bind(instance);
    instance.save = async function () {
      if (this.password && !this.password.startsWith("$2a$") && !this.password.startsWith("$2b$")) {
        this.password = await bcrypt.hash(this.password, 12);
      }
      return await originalSave();
    };

    return instance;
  }
}

