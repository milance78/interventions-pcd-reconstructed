import "./InputsAll.scss";

import Numbers from "@mui/icons-material/Numbers";
import {
  Contact,
  House,
  KeyRound,
  NotebookTabs,
  PhoneCall,
  TextInitial,
} from "lucide-react";

import SimpleInput from "../simpleInput/SimpleInput";

import { ReactComponent as CIDIcon } from "../../../assets/svg/CID.svg.tsx";
import { ReactComponent as IDIcon } from "../../../assets/svg/ID.svg.tsx";
import { ReactComponent as NAIcon } from "../../../assets/svg/NA.svg.tsx";
import { ReactComponent as OAGIcon } from "../../../assets/svg/OAG.svg.tsx";

const InputsAll = () => {
  return (
    <div className="inputs-all">
      <section className="inputs-row inputs-row--half">
        <SimpleInput
          field="interventionId"
          label="ID de l'intervention"
          inputType="type2"
          icon={IDIcon}
        />

        <SimpleInput
          field="oagID"
          label="OAG ID"
          inputType="type2"
          icon={OAGIcon}
        />
      </section>

      <section className="inputs-row inputs-row--half">
        <SimpleInput
          field="snowReference"
          label="Référence SNOW"
          inputType="type2"
          icon={Numbers}
        />

        <SimpleInput
          field="clientID"
          label="ID client"
          inputType="type2"
          icon={Contact}
        />
      </section>

      <section className="inputs-row inputs-row--full">
        <SimpleInput
          field="interventionDescription"
          label="Description d'intervention"
          inputType="type2"
          icon={TextInitial}
        />
      </section>

      <section className="inputs-row inputs-row--half">
        <SimpleInput
          field="na"
          label="NA"
          inputType="type2"
          icon={NAIcon}
        />

        <SimpleInput
          field="cid"
          label="CID"
          inputType="type2"
          icon={CIDIcon}
        />
      </section>

      <section className="inputs-row inputs-row--main-address">
        <SimpleInput
          field="mainAddress"
          label="Adresse principale"
          inputType="type2"
          icon={House}
          className="simple-input--main-address"
        />

        <SimpleInput
          field="LOMKey"
          label="LOM key"
          inputType="type2"
          icon={KeyRound}
          className="simple-input--lom-key"
        />
      </section>

      <section className="inputs-row inputs-row--half">
        <SimpleInput
          field="addressDetails"
          label="Détails d'adresse"
          inputType="type2"
          icon={NotebookTabs}
        />

        <SimpleInput
          field="phone"
          label="Nº de téléphone (GSM)"
          inputType="type2"
          icon={PhoneCall}
        />
      </section>
    </div>
  );
};

export default InputsAll;
