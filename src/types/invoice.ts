export type LineItem = {
    tekstur: string;
    nøgd: string;
    prísur: string;
    avsláttur: string;
    upphædd: string;
  };
  export type Customer = {
    fyritøka: string;
    navn: string;
    addressa: string;
    postnummar: string;
    bygd: string;
    teldupostur: string;
  };
export type Invoice = {
    id: number;
    createdDate: string;
    dueDate: string;
    total: number;
    status: string;
    customer: Customer;
    list: LineItem[];
  };
  export type Invoices = {
    rokningar: Record<string, Invoice>;
  };