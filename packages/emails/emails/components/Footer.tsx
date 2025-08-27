import { Hr, Text } from "@react-email/components";
import React from "react";
import { footer, hr, paragraphLight } from "./styles";

export function Footer() {
  return (
    <>
      <Hr style={hr} />
      <Text style={paragraphLight}>happy building your digital brain!</Text>
      <Text style={footer}>
        the Core team P.S Questions?
        <br />
        Just hit reply - we're here to help.
      </Text>
    </>
  );
}
