[@genType]
let strip0x = y => {
  Js.String.startsWith("0x", y) ? Js.String.substr(~from=2, y) : y;
};