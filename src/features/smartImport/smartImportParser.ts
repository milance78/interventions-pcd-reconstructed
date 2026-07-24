import type { InterventionData } from "../../redux/features/newInterventionSlice";

export type SmartImportResult = {
  values: Partial<InterventionData>;
  detectedFields: string[];
  sourceType: "NPS" | "SNOW" | "ISIS" | "SAFE" | "UNKNOWN";
};

const clean = (value: string | undefined) =>
  (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/^\s+|\s+$/g, "");

const meaningful = (value: string | undefined) => {
  const normalized = clean(value);
  return normalized && normalized !== "--" && normalized !== "-" ? normalized : "";
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findAfterLabel = (text: string, labels: string[]): string => {
  for (const label of labels) {
    const escaped = escapeRegExp(label);
    const patterns = [
      new RegExp(`(?:^|\\n)\\s*${escaped}\\s*[\\t:]+\\s*([^\\n\\t]+)`, "im"),
      new RegExp(`(?:^|\\n)\\s*${escaped}\\s{2,}([^\\n]+)`, "im"),
      new RegExp(`${escaped}\\s*[\\t:]+\\s*([^\\n\\t]+)`, "i"),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      const value = meaningful(match?.[1]);
      if (value) return value;
    }
  }
  return "";
};

const findTableValue = (text: string, label: string): string => {
  const lines = text.split(/\r?\n/);
  const target = label.toLowerCase();

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const cells = lines[lineIndex].split(/\t+/).map(clean);
    const index = cells.findIndex((cell) => cell.toLowerCase() === target);
    if (index < 0) continue;

    const sameLineValue = meaningful(cells[index + 1]);
    if (sameLineValue && !/^(Prénom|Code postal|Nom de la ville|N°|No |Adresse)/i.test(sameLineValue)) {
      return sameLineValue;
    }

    for (let nextIndex = lineIndex + 1; nextIndex < Math.min(lines.length, lineIndex + 4); nextIndex += 1) {
      const nextCells = lines[nextIndex].split(/\t+/).map(clean);
      if (!nextCells.some(Boolean)) continue;
      const value = meaningful(nextCells[index]);
      if (value) return value;
      break;
    }
  }
  return "";
};

const first = (...values: string[]) => values.find(Boolean) ?? "";

const splitWideCells = (line: string) =>
  line
    .split(/\t+| {2,}/)
    .map(clean)
    .filter(Boolean);

// Browser table copy/paste uses four spaces between columns. Keeping empty
// cells is essential: otherwise a blank Mail Box shifts "Etage",
// "Appartement", "N° de bloc" and "LOM Key" into the wrong inputs.
const splitTableCells = (line: string) =>
  line
    .split(/\t+| {4}/)
    .map(clean);

const findValueBesideLabel = (text: string, labels: string[]): string => {
  const allLabels = [
    "Provisioning Order Id",
    "ID d'intervention",
    "OA ID / POI ID",
    "Code d'erreur",
    "Descriptions",
    "Date de création (jj/mm/aaaa hh:mm:ss)",
    "Date souhaitée (jj/mm/aaaa hh:mm:ss)",
    "Statut",
    "Source",
    "Priorité",
    "Remarques",
    "INTERVENTION_ID",
    "OAG_ID",
    "INTERVENTION_DESCRIPTION",
    "CUSTOMER_ID",
    "LIST_FILTER",
    "TECHNOLOGY",
    "TICKET_NUM",
    "CUST_LANGUAGE",
  ];

  for (const line of text.split(/\r?\n/)) {
    const cells = splitWideCells(line);
    if (cells.length < 2) continue;

    for (const label of labels) {
      const index = cells.findIndex(
        (cell) => cell.toLowerCase() === label.toLowerCase(),
      );
      if (index < 0) continue;

      const candidate = meaningful(cells[index + 1]);
      if (
        candidate &&
        !allLabels.some(
          (knownLabel) => knownLabel.toLowerCase() === candidate.toLowerCase(),
        )
      ) {
        return candidate;
      }
    }
  }

  return "";
};

const extractFixedWidthRow = (
  text: string,
  requiredHeader: string,
  headers: string[],
): Record<string, string> => {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    line.toLowerCase().includes(requiredHeader.toLowerCase()),
  );
  if (headerIndex < 0) return {};

  const headerLine = lines[headerIndex];
  const positions = headers
    .map((header) => ({ header, index: headerLine.indexOf(header) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index);
  if (!positions.length) return {};

  let valueLine = "";
  for (let index = headerIndex + 1; index < Math.min(lines.length, headerIndex + 5); index += 1) {
    if (lines[index].trim()) {
      valueLine = lines[index];
      break;
    }
  }
  if (!valueLine) return {};

  const result: Record<string, string> = {};
  positions.forEach((position, index) => {
    const end = positions[index + 1]?.index ?? valueLine.length;
    result[position.header] = meaningful(valueLine.slice(position.index, end));
  });
  return result;
};

const extractContactRow = (text: string): Record<string, string> => {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    line.includes("Nom de la personne de contact") && line.includes("N° de GSM"),
  );
  if (headerIndex < 0) return {};

  const valueLine = lines.slice(headerIndex + 1, headerIndex + 5).find((line) => line.trim());
  if (!valueLine) return {};
  const values = splitTableCells(valueLine);

  return {
    "Type de contact": meaningful(values[0]),
    "Catégorie de contact": meaningful(values[1]),
    "Nom de la personne de contact": meaningful(values[2]),
    "Numéro de contact": meaningful(values[3]),
    "N° de GSM": meaningful(values[4]),
    "Adresse e-mail": meaningful(values[5]),
    "Responsable ventes": meaningful(values[6]),
  };
};

const extractNewAddressSection = (text: string): string => {
  const startMatch = /(?:^|\n)\s*Nouvelle adresse\b/i.exec(text);
  if (!startMatch) return "";

  const start = startMatch.index + startMatch[0].length;
  const remaining = text.slice(start);
  const endPatterns = [
    /(?:^|\n)\s*Ancienne adresse\b/i,
    /(?:^|\n)\s*Manual TSI\/Design reason\b/i,
    /(?:^|\n)\s*Stop Servicing Copper Date\b/i,
    /(?:^|\n)\s*Order Viewer Links\b/i,
  ];

  const endOffsets = endPatterns
    .map((pattern) => pattern.exec(remaining)?.index)
    .filter((index): index is number => typeof index === "number");

  const end = endOffsets.length ? Math.min(...endOffsets) : remaining.length;
  return remaining.slice(0, end);
};

const extractNewAddressInfrastructure = (text: string): string => {
  const section = extractNewAddressSection(text);
  if (!section) return "";

  for (const line of section.split(/\r?\n/)) {
    const cells = splitWideCells(line);
    for (const cell of cells) {
      if (/^(FIBER|FIBRE)$/i.test(cell)) return "fiber";
      if (/^(COPPER|CUIVRE)$/i.test(cell)) return "copper";
    }
  }

  return "";
};

const extractAddressRow = (text: string): Record<string, string> => {
  // Address and infrastructure must come exclusively from the "Nouvelle adresse"
  // block. Any "Ancienne adresse" block is intentionally ignored.
  const newAddressSection = extractNewAddressSection(text);
  if (!newAddressSection) return {};

  const lines = newAddressSection.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    line.includes("N° de maison alphanumérique") && line.includes("LOM Key"),
  );
  if (headerIndex < 0) return {};

  const valueLine = lines.slice(headerIndex + 1, headerIndex + 5).find((line) => line.trim());
  if (!valueLine) return {};
  const values = splitTableCells(valueLine);

  const labels = [
    "Pays",
    "Code postal",
    "Nom de la ville",
    "Nom de la rue",
    "N° de maison",
    "N° de maison alphanumérique",
    "Mail Box",
    "Etage",
    "Appartement",
    "N° de bloc",
    "LOM Key",
    "subArea",
    "Indicateur MDU/SDU",
    "ZONE:",
  ];

  return Object.fromEntries(
    labels.map((label, index) => [label, meaningful(values[index])]),
  );
};

const extractCustomerRow = (text: string): Record<string, string> => {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    line.includes("ID client") && line.includes("Partner Account ID") && line.includes("Nom de famille"),
  );
  if (headerIndex < 0) return {};

  const valueLine = lines.slice(headerIndex + 1, headerIndex + 5).find((line) => line.trim());
  if (!valueLine) return {};
  const values = splitTableCells(valueLine);

  return {
    "ID client": meaningful(values[0]),
    "Partner Account ID": meaningful(values[1]),
    "Nom de famille": meaningful(values[2]),
    Prénom: meaningful(values[3]),
  };
};

const detectSource = (text: string): SmartImportResult["sourceType"] => {
  const upper = text.toUpperCase();
  if (upper.includes("SNOW_TITLE") || upper.includes("SNOW_ID")) return "SNOW";
  if (upper.includes("WORK ITEM TREATMENT") || upper.includes("NPS_EXCEPTION_CD")) return "NPS";
  if (upper.includes("FISISINTV") || upper.includes("INFORMATIONS 'SERVICE ORDER'")) return "ISIS";
  if (upper.includes("FSAFEMLONU") || upper.includes("ORDER VIEWER LINKS")) return "SAFE";
  return "UNKNOWN";
};

const normalizeInfrastructure = (raw: string) => {
  const value = raw.toUpperCase();
  if (/\bFIBER\b|\bFIBRE\b/.test(value)) return "fiber";
  if (/\bCOPPER\b|\bCUIVRE\b/.test(value)) return "copper";
  return "";
};

const normalizeNetwork = (text: string) => {
  const upper = text.toUpperCase();
  if (upper.includes("MOBILE VIKINGS")) return "mobileVikings";
  if (upper.includes("SCARLET")) return "scarlet";
  if (/\bOLO\b/.test(upper) && !upper.includes("IS_OLO\tNO")) return "otherOlo";
  if (upper.includes("PROXIMUS") || upper.includes("PXS") || upper.includes("NPS")) return "proximus";
  return "";
};

const normalizeStatus = (raw: string) => {
  const upper = raw.toUpperCase();
  if (/DONE|TERMIN|CLOSED|RESOLVED/.test(upper)) return "completed";
  if (/WAIT|PENDING|HOLD|CURE CONTACT|INPROGRESS|IN PROGRESS/.test(upper)) return "on hold";
  if (/ROUTE|TRANSFER|TRANSMIS/.test(upper)) return "transferred";
  return "";
};

const composeClientName = (text: string) => {
  const contactRow = extractContactRow(text);
  const contactName = meaningful(contactRow["Nom de la personne de contact"]);
  if (contactName) return contactName;

  const customerRow = extractCustomerRow(text);
  const tableName = clean(`${customerRow["Prénom"] ?? ""} ${customerRow["Nom de famille"] ?? ""}`);
  if (tableName) return tableName;

  const explicit = first(
    findValueBesideLabel(text, ["Nom du client", "CUSTOMER_NAME"]),
    findAfterLabel(text, ["Nom du client", "CUSTOMER_NAME"]),
    findTableValue(text, "Nom de famille"),
  );
  if (explicit && !/^(Prénom|N\.P\.C\.)$/i.test(explicit)) {
    const firstName = first(
      findValueBesideLabel(text, ["CUST_FIRST_NAME"]),
      findAfterLabel(text, ["CUST_FIRST_NAME"]),
      findTableValue(text, "Prénom"),
    );
    if (firstName && !explicit.toLowerCase().includes(firstName.toLowerCase())) {
      return clean(`${explicit} ${firstName}`);
    }
    return explicit;
  }

  const lastName = first(
    findValueBesideLabel(text, ["CUST_LAST_NAME"]),
    findAfterLabel(text, ["CUST_LAST_NAME"]),
  );
  const firstName = first(
    findValueBesideLabel(text, ["CUST_FIRST_NAME"]),
    findAfterLabel(text, ["CUST_FIRST_NAME"]),
  );
  return clean(`${lastName} ${firstName}`);
};

const parseStructuredAddress = (text: string) => {
  const newAddressSection = extractNewAddressSection(text);
  const addressRow = extractAddressRow(text);
  const hasStructuredRow = Object.keys(addressRow).length > 0;

  const rowOrFallback = (
    rowLabel: string,
    fallbackLabels: string[],
  ) => {
    if (hasStructuredRow) return meaningful(addressRow[rowLabel]);
    if (!newAddressSection) return "";

    // Even the fallback search is restricted to "Nouvelle adresse". This
    // prevents fields from an "Ancienne adresse" block being imported.
    return first(
      findValueBesideLabel(newAddressSection, fallbackLabels),
      findAfterLabel(newAddressSection, fallbackLabels),
      findTableValue(newAddressSection, rowLabel),
    );
  };

  const street = rowOrFallback("Nom de la rue", ["ADDRESS_STREET_NAME", "Nom de la rue"]);
  const number = rowOrFallback("N° de maison", ["ADDRESS_HOUSE_NUMBER", "N° de maison", "No de maison"]);
  const alpha = rowOrFallback("N° de maison alphanumérique", [
    "N° de maison alphanumérique",
    "No de maison alphanumérique",
  ]);
  const zip = rowOrFallback("Code postal", ["ADDRESS_ZIP_CODE", "Code postal"]);
  const city = rowOrFallback("Nom de la ville", ["ADDRESS_CITY_NAME", "Nom de la ville"]);
  const mailbox = rowOrFallback("Mail Box", ["ADDRESS_BOX", "Mail Box", "Boîte", "Boite"]);
  const floor = rowOrFallback("Etage", ["ADDRESS_FLOOR", "Etage", "Étage"]);
  const apartment = rowOrFallback("Appartement", ["Appartement", "N° appartement", "No appartement"]);
  const blockNumber = rowOrFallback("N° de bloc", ["N° de bloc", "No de bloc", "Block"]);

  const house = clean(`${number}${alpha}`);
  const streetAndNumber = clean(`${street} ${house}`);
  const cityLine = clean(`${zip} ${city}`);
  const mainAddress = streetAndNumber && cityLine
    ? `${streetAndNumber}, ${cityLine}`
    : first(streetAndNumber, cityLine);

  return {
    mainAddress,
    // Legacy field remains empty. The four dedicated inputs are now the
    // single source of truth for address details.
    addressDetails: "",
    mailbox,
    floor,
    apartment,
    blockNumber,
    lomKey: hasStructuredRow ? meaningful(addressRow["LOM Key"]) : "",
  };
};

const latestHumanJournalMessage = (text: string) => {
  const journalIndex = text.search(/\bJournal\b/i);
  if (journalIndex < 0) return "";
  const journal = text.slice(journalIndex);
  const regex = /(?:^|\n)(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s+([^\n\t]+?)\s*[\t]+([^\n]+)/g;
  let match: RegExpExecArray | null;
  const messages: string[] = [];
  while ((match = regex.exec(journal))) {
    const author = clean(match[2]);
    const message = clean(match[3]);
    if (!/SYSTEM/i.test(author) && message && !/^\.:/.test(message)) messages.push(message);
  }
  return messages[0] ?? "";
};

const extractRemarks = (text: string) => {
  const blocks: string[] = [];
  const orderRemarks = findAfterLabel(text, ["Remarques ordre"]);
  const remarks = findAfterLabel(text, ["Remarques"]);
  if (orderRemarks) blocks.push(`Remarques ordre\n${orderRemarks}`);
  if (remarks && remarks !== orderRemarks) blocks.push(`Remarques\n${remarks}`);
  return blocks.join("\n\n");
};



export const parseSmartImport = (rawText: string): SmartImportResult => {
  const text = rawText.replace(/\r/g, "").replace(/\uFFFD/g, "'");
  const sourceType = detectSource(text);
  const address = parseStructuredAddress(text);
  const customerRow = extractCustomerRow(text);

  const interventionId = first(
    findValueBesideLabel(text, ["INTERVENTION_ID", "ID d'intervention", "Identifyer"]),
    findAfterLabel(text, ["INTERVENTION_ID", "ID d'intervention", "Identifyer"]),
    findTableValue(text, "ID d'intervention"),
  );
  const oagID = first(
    findValueBesideLabel(text, ["OAG_ID", "OAG ID / PO ID", "Provisioning Order Id"]),
    findAfterLabel(text, ["OAG_ID", "OAG ID / PO ID", "Provisioning Order Id"]),
    findTableValue(text, "OAG ID / PO ID"),
  );
  const snowReference = first(findAfterLabel(text, ["SNOW_ID"]), findAfterLabel(text, ["Ticket"]));
  const description = first(
    findValueBesideLabel(text, ["INTERVENTION_DESCRIPTION", "NPS_EXC_DESCRIPTION", "Descriptions", "SNOW_TITLE"]),
    findAfterLabel(text, ["INTERVENTION_DESCRIPTION", "NPS_EXC_DESCRIPTION", "Descriptions", "SNOW_TITLE"]),
    findTableValue(text, "Descriptions"),
  );
  const clientID = first(
    findValueBesideLabel(text, ["CUSTOMER_ID", "CUST_NUM"]),
    findAfterLabel(text, ["CUSTOMER_ID", "CUST_NUM"]),
    meaningful(customerRow["ID client"]),
  );
  // Partner Account ID is not an NA value. NA is imported only when an
  // explicit NA field exists, and it remains empty for fibre interventions.
  const explicitNa = first(
    findValueBesideLabel(text, ["NA"]),
    findAfterLabel(text, ["NA"]),
  );
  const contactRow = extractContactRow(text);
  const phone = first(
    meaningful(contactRow["N° de GSM"]),
    findValueBesideLabel(text, ["N° de GSM", "Numéro de contact", "CUST_PHONE", "PHONE"]),
    findAfterLabel(text, ["N° de GSM", "Numéro de contact", "CUST_PHONE", "PHONE"]),
    findTableValue(text, "N° de GSM"),
    findTableValue(text, "Numéro de contact"),
  );
  // LOM Key is also part of the new-address block and must never be taken
  // from an old-address section.
  const lomKey = address.lomKey;
  const infrastructure = extractNewAddressInfrastructure(text);
  const na = infrastructure === "fiber" ? "" : explicitNa;
  const rawStatus = first(findValueBesideLabel(text, ["Status", "Statut", "NPS_STATUS"]), findAfterLabel(text, ["Status", "Statut", "NPS_STATUS"]), findTableValue(text, "Statut"));
  const comment = first(latestHumanJournalMessage(text), findAfterLabel(text, ["Remarques"]));

  const values: Partial<InterventionData> = {
    interventionId,
    oagID,
    snowReference,
    interventionDescription: description,
    clientID,
    na,
    clientName: composeClientName(text),
    mainAddress: address.mainAddress,
    addressDetails: address.addressDetails,
    mailbox: address.mailbox,
    floor: address.floor,
    apartment: address.apartment,
    blockNumber: address.blockNumber,
    LOMKey: lomKey,
    phone,
    infrastructure: normalizeInfrastructure(infrastructure),
    network: normalizeNetwork(text),
    status: normalizeStatus(rawStatus),
    comment,
    isSnow: sourceType === "SNOW" || Boolean(snowReference),
    displayAllFields: true,
  };

  const filteredValues = Object.fromEntries(
    Object.entries(values).filter(([, value]) =>
      typeof value === "string" ? Boolean(value.trim()) : value !== undefined,
    ),
  ) as Partial<InterventionData>;

  return {
    values: filteredValues,
    detectedFields: Object.keys(filteredValues),
    sourceType,
  };
};
