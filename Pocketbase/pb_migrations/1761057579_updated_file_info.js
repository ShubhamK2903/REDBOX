/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_643743649")

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "bool1350577436",
    "name": "is_encrypted",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2415649015",
    "max": 0,
    "min": 0,
    "name": "salt",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1283462680",
    "max": 0,
    "min": 0,
    "name": "iv",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_643743649")

  // remove field
  collection.fields.removeById("bool1350577436")

  // remove field
  collection.fields.removeById("text2415649015")

  // remove field
  collection.fields.removeById("text1283462680")

  return app.save(collection)
})
