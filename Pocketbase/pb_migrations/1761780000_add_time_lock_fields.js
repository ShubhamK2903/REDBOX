/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1619759698")

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "bool_time_enabled",
    "name": "time_enabled",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "date_unlock_at",
    "max": "",
    "min": "",
    "name": "unlock_at",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1619759698")

  // remove field
  collection.fields.removeById("bool_time_enabled")

  // remove field
  collection.fields.removeById("date_unlock_at")

  return app.save(collection)
})
