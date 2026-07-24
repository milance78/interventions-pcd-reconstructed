import TextField from "@mui/material/TextField";

import "./AddressMiniInput.scss";

import type { InterventionField } from "../../../redux/features/newInterventionSlice";
import { updateField } from "../../../redux/features/newInterventionSlice";
import { useAppDispatch, useAppSelector } from "../../../redux/store";

interface AddressMiniInputProps {
  field: InterventionField;
  label: string;
}

const AddressMiniInput = ({ field, label }: AddressMiniInputProps) => {
  const dispatch = useAppDispatch();
  const value = useAppSelector((state) => state.newIntervention[field]);
  const stringValue = typeof value === "string" ? value : "";

  return (
    <TextField
      className="address-mini-input"
      size="small"
      fullWidth
      label={label}
      value={stringValue}
      onChange={(event) =>
        dispatch(updateField({ field, value: event.target.value }))
      }
      inputProps={{ "aria-label": label }}
    />
  );
};

export default AddressMiniInput;
