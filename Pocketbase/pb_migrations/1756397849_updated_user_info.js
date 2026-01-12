/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3140665208")

  // remove field
  collection.fields.removeById("select3583823516")

  // add field
  collection.fields.addAt(9, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3583823516",
    "max": 500,
    "min": 1,
    "name": "security_question",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3140665208")

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "select3583823516",
    "maxSelect": 2,
    "name": "security_question",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "What was your first pet's name?",
      "What is your childhood nickname?",
      "What was the name of your first school?",
      "Who was your childhood hero?"
    ]
  }))

  // remove field
  collection.fields.removeById("text3583823516")

  return app.save(collection)
})
