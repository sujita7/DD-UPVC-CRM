/**
 * Model Factory
 * Wraps MySQLModel so that both `new Model(data)` and static `Model.find(...)` work identically to Mongoose.
 */

export function createModel(modelInstance) {
  function ModelConstructor(data = {}) {
    return modelInstance.createInstance(data);
  }

  // Delegate all static query & CRUD methods
  ModelConstructor.create = (data) => modelInstance.create(data);
  ModelConstructor.find = (filter) => modelInstance.find(filter);
  ModelConstructor.findOne = (filter) => modelInstance.findOne(filter);
  ModelConstructor.findById = (id) => modelInstance.findById(id);
  ModelConstructor.findByIdAndUpdate = (id, data, opts) => modelInstance.findByIdAndUpdate(id, data, opts);
  ModelConstructor.findByIdAndDelete = (id) => modelInstance.findByIdAndDelete(id);
  ModelConstructor.deleteOne = (filter) => modelInstance.deleteOne(filter);
  ModelConstructor.deleteMany = (filter) => modelInstance.deleteMany(filter);
  ModelConstructor.countDocuments = (filter) => modelInstance.countDocuments(filter);
  ModelConstructor.aggregate = (pipeline) => modelInstance.aggregate(pipeline);

  return ModelConstructor;
}

