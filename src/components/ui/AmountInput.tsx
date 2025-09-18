import { NumericFormat } from "react-number-format";
import { Input } from "~/components/ui/input"; // your custom input

export const AmountInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) => {
  return (
    <NumericFormat
      customInput={Input}
      value={value}
      onValueChange={(values) => {
        if (values.value.length > 18) {
          onChange("");
          return;
        }
        onChange(values.value);
      }}
      thousandSeparator
      valueIsNumericString
      allowNegative={false} //  no negatives
      decimalScale={2} // max 6 decimals
      placeholder="0.00"
      className="bg-[#333333] text-white border-2 border-[#333333] rounded-md"
    />
  );
};
