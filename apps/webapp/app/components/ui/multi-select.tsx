"use client";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { ChevronDown } from "lucide-react";
import { type Dispatch, type SetStateAction } from "react";

type Option = { label: string; value: string };

interface ISelectProps {
  placeholder: string;
  options: Option[];
  selectedOptions: string[];
  setSelectedOptions: Dispatch<SetStateAction<string[]>>;
}
const MultiSelect = ({
  placeholder,
  options: values,
  selectedOptions: selectedItems,
  setSelectedOptions: setSelectedItems,
}: ISelectProps) => {
  const handleSelectChange = (value: string) => {
    if (!selectedItems.includes(value)) {
      setSelectedItems((prev) => [...prev, value]);
    } else {
      const referencedArray = [...selectedItems];
      const indexOfItemToBeRemoved = referencedArray.indexOf(value);
      referencedArray.splice(indexOfItemToBeRemoved, 1);
      setSelectedItems(referencedArray);
    }
  };

  const isOptionSelected = (value: string): boolean => {
    return selectedItems.includes(value) ? true : false;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild className="w-full">
          <Button
            variant="secondary"
            className="flex h-8 w-full items-center justify-between"
          >
            <div className="text-muted-foreground">{placeholder}</div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56 border-none text-base"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {values.map((value: ISelectProps["options"][0], index: number) => {
            return (
              <DropdownMenuCheckboxItem
                onSelect={(e) => e.preventDefault()}
                key={index}
                checked={isOptionSelected(value.value)}
                onCheckedChange={() => handleSelectChange(value.value)}
              >
                {value.label}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export default MultiSelect;
