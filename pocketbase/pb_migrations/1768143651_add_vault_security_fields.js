/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1619759698")

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "bool_password_enabled",
    "name": "password_enabled",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_password_hash",
    "max": 255,
    "min": 0,
    "name": "password_hash",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "bool_geo_enabled",
    "name": "geo_enabled",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "number_geo_lat",
    "max": null,
    "min": null,
    "name": "geo_lat",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "number_geo_lng",
    "max": null,
    "min": null,
    "name": "geo_lng",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "number_geo_radius",
    "max": null,
    "min": null,
    "name": "geo_radius",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1619759698")

  // remove field
  collection.fields.removeById("bool_password_enabled")

  // remove field
  collection.fields.removeById("text_password_hash")

  // remove field
  collection.fields.removeById("bool_geo_enabled")

  // remove field
  collection.fields.removeById("number_geo_lat")

  // remove field
  collection.fields.removeById("number_geo_lng")

  // remove field
  collection.fields.removeById("number_geo_radius")

  return app.save(collection)
})
