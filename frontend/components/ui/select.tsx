import * as React from "react";
import {cn} from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({className, ...props}, ref) => <select ref={ref} className={cn("input select", className)} {...props} />);
Select.displayName = "Select";

