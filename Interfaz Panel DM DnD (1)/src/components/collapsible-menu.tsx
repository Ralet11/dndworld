import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { ChevronRight, ChevronDown } from "lucide-react";

interface CollapsibleMenuProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleMenu({ title, icon, children, defaultOpen = false }: CollapsibleMenuProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="mb-2">
      <CardHeader className="p-2">
        <Button
          variant="ghost"
          className="w-full justify-between p-2 h-auto"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center space-x-2">
            {icon}
            <span className="text-sm font-medium">{title}</span>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      {isOpen && (
        <CardContent className="p-2 pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}