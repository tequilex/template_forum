// Декларация для side-effect импортов CSS (`import "./foo.css"`).
// Без неё VS Code TS Language Server жалуется на TS2882, хотя `tsc` и
// бандлер Next разрешают такие импорты сами.
declare module "*.css";
