/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_643743649")

  // add field
  collection.fields.addAt(10, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1619759698",
    "hidden": false,
    "id": "relation2935228412",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "vault_name",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_643743649")

  // remove field
  collection.fields.removeById("relation2935228412")

  return app.save(collection)
})
