/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3140665208")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_wOQNacTLgw` ON `user_info` (`email`)",
      "CREATE UNIQUE INDEX `idx_email_pbc_3140665208` ON `user_info` (`email`) WHERE `email` != ''",
      "CREATE UNIQUE INDEX `idx_tokenKey_pbc_3140665208` ON `user_info` (`tokenKey`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3140665208")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_wOQNacTLgw` ON `user_info` (`email`)",
      "CREATE UNIQUE INDEX `idx_tokenKey_pbc_3140665208` ON `user_info` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email_pbc_3140665208` ON `user_info` (`email`) WHERE `email` != ''"
    ]
  }, collection)

  return app.save(collection)
})
