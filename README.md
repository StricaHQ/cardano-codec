<p align="center">
  <a href="https://strica.io/" target="_blank">
    <img src="https://docs.strica.io/images/logo.png" width="200">
  </a>
</p>

# @stricahq/cardano-codec
Cardano Codec is a Cardano data type parsing library. Parse Cardano CDDL encoded data into plain JSON data types using Cardano era specific parsers.

Currently Byron, Alonzo, and Babbage era parsers are available. Parsers being backward compatible you can use Alonzo or Babbage parser to parse previous shelley era data types without any issues.

## Used By
- [cardanoscan.io](https://cardanoscan.io)
- [Typhon Wallet](https://typhonwallet.io)

## Installation

### yarn/npm

```sh
yarn add @stricahq/cardano-codec
```

## Tests
TODO

## API Doc
Find the API documentation [here](https://docs.strica.io/lib/cardano-codec)

# License
Copyright 2023 Strica

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.