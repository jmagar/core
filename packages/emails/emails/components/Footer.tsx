import { Hr, Link, Text } from "@react-email/components";
import React from "react";
import { footer, footerAnchor, hr } from "./styles";

export function Footer() {
  return (
    <>
      <Hr style={hr} />
      <Text style={footer}>
        ©Sol.ai
        <Link style={footerAnchor} href="https://core.heysol.dev/">
          C.O.R.E
        </Link>
      </Text>
    </>
  );
}
