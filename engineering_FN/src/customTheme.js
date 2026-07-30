// src/theme/customTheme.js
import { extendTheme } from "@chakra-ui/react";

const customTheme = extendTheme({
  styles: {
    global: (props) => ({
      body: {
        bg: props.colorMode === "dark" ? "#000000" : "#ffffff", // Set dark mode to pure black
      },
    }),
  },
});

export default customTheme;
