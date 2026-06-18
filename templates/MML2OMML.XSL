<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
                xmlns:mml="http://www.w3.org/1998/Math/MathML"
                exclude-result-prefixes="mml">
  <xsl:output method="xml" indent="yes" omit-xml-declaration="yes"/>

  <!-- Main Math container -->
  <xsl:template match="mml:math">
    <m:oMathPara>
      <m:oMath>
        <xsl:apply-templates/>
      </m:oMath>
    </m:oMathPara>
  </xsl:template>

  <!-- Row container -->
  <xsl:template match="mml:mrow">
    <xsl:apply-templates/>
  </xsl:template>

  <!-- Number, Identifiers, Operators -->
  <xsl:template match="mml:mn | mml:mi | mml:mo">
    <m:r>
      <m:t><xsl:value-of select="."/></m:t>
    </m:r>
  </xsl:template>

  <!-- Fraction -->
  <xsl:template match="mml:mfrac">
    <m:f>
      <m:num>
        <xsl:apply-templates select="*[1]"/>
      </m:num>
      <m:den>
        <xsl:apply-templates select="*[2]"/>
      </m:den>
    </m:f>
  </xsl:template>

  <!-- Superscript -->
  <xsl:template match="mml:msup">
    <m:sSup>
      <m:e>
        <xsl:apply-templates select="*[1]"/>
      </m:e>
      <m:sup>
        <xsl:apply-templates select="*[2]"/>
      </m:sup>
    </m:sSup>
  </xsl:template>

  <!-- Subscript -->
  <xsl:template match="mml:msub">
    <m:sSub>
      <m:e>
        <xsl:apply-templates select="*[1]"/>
      </m:e>
      <m:sub>
        <xsl:apply-templates select="*[2]"/>
      </m:sub>
    </m:sSub>
  </xsl:template>

  <!-- SubSuperScript -->
  <xsl:template match="mml:msubsup">
    <m:sSubSup>
      <m:e>
        <xsl:apply-templates select="*[1]"/>
      </m:e>
      <m:sub>
        <xsl:apply-templates select="*[2]"/>
      </m:sub>
      <m:sup>
        <xsl:apply-templates select="*[3]"/>
      </m:sup>
    </m:sSubSup>
  </xsl:template>

  <!-- Square root -->
  <xsl:template match="mml:msqrt">
    <m:rad>
      <m:deg/>
      <m:e>
        <xsl:apply-templates/>
      </m:e>
    </m:rad>
  </xsl:template>
  
  <!-- Fence / Delimiters -->
  <xsl:template match="mml:mfenced">
    <m:d>
      <m:dPr>
        <m:begChr xsl:val="(@open, '(')[1]"/>
        <m:endChr xsl:val="(@close, ')')[1]"/>
      </m:dPr>
      <m:e>
        <xsl:apply-templates/>
      </m:e>
    </m:d>
  </xsl:template>
</xsl:stylesheet>
