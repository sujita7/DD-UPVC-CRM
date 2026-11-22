import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    dueTime: {
      type: String,
      default: "18:00",
      trim: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "delayed"],
      default: "pending",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    assignedTo: {
      type: String,
      trim: true,
      default: "Admin",
    },
    completedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Auto-generate taskId
taskSchema.pre("save", async function (next) {
  if (!this.taskId) {
    const count = await mongoose.model("Task").countDocuments();
    this.taskId = `TSK-${String(count + 1).padStart(3, "0")}`;
  }
  next();
});

const Task = mongoose.model("Task", taskSchema);
export default Task;

