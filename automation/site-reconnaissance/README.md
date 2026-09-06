# Site reconnaissance fixture gate

This directory is root-only automation. The installed plugin carries the method
and Markdown ledger template; validators and evidence fixtures stay outside the
marketplace payload under ADR-011.

The offline fixture proves the ledger contract without pretending that an
unavailable browser or GPU ran. A `PASS` ledger still needs a public credential-
free URL, explicit runtime-reconnaissance request, primary semantic artifacts for
bundle, network, `renderer.info`, Inspector, and shader extraction, and at least
ten supported fields: two from each family. Screenshots can supplement an
Inspector capture, but cannot activate the skill or support a field alone.

Run from the repository root:

```bash
node automation/site-reconnaissance/validate-site-reconnaissance.mjs \
  tests/immersive/site-reconnaissance/fixtures/site-reconnaissance.valid.json
node automation/site-reconnaissance/validate-description.mjs
node --test tests/immersive/site-reconnaissance/site-reconnaissance.test.mjs
```

The fixture validators are offline and use no browser, GPU, network, credentials,
or paid design-tool dependency. A runtime/tool limitation belongs in the ledger as
`UNAVAILABLE`; the validator refuses to treat it as `PASS`.
