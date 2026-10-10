import type { Column, Row } from "./table-scope.ts";

const money = (value: string | number) => `$${value}`;

export const orderColumns: readonly Column[] = [
  { key: "id", label: "Order" },
  { key: "customer", label: "Customer" },
  { key: "date", label: "Date" },
  { format: money, key: "total", label: "Total" },
  { key: "status", label: "Status" },
];

export const orders: readonly Row[] = [
  {
    customer: "Ada Lovelace",
    date: "2026-10-08",
    id: "#1042",
    status: "Paid",
    total: 182,
  },
  {
    customer: "Grace Hopper",
    date: "2026-10-08",
    id: "#1041",
    status: "Pending",
    total: 64,
  },
  {
    customer: "Alan Turing",
    date: "2026-10-07",
    id: "#1040",
    status: "Paid",
    total: 420,
  },
  {
    customer: "Ada Lovelace",
    date: "2026-10-06",
    id: "#1039",
    status: "Refunded",
    total: 23,
  },
  {
    customer: "Linus Torvalds",
    date: "2026-10-05",
    id: "#1038",
    status: "Paid",
    total: 310,
  },
  {
    customer: "Margaret Hamilton",
    date: "2026-10-04",
    id: "#1037",
    status: "Pending",
    total: 95,
  },
  {
    customer: "Grace Hopper",
    date: "2026-10-03",
    id: "#1036",
    status: "Paid",
    total: 150,
  },
  {
    customer: "Ken Thompson",
    date: "2026-10-02",
    id: "#1035",
    status: "Paid",
    total: 78,
  },
  {
    customer: "Barbara Liskov",
    date: "2026-10-01",
    id: "#1034",
    status: "Pending",
    total: 260,
  },
];

export const customerColumns: readonly Column[] = [
  { key: "name", label: "Name" },
  { key: "city", label: "City" },
  { format: String, key: "orders", label: "Orders" },
];

export const customers: readonly Row[] = [
  { city: "London", id: "ada", name: "Ada Lovelace", orders: 3 },
  { city: "New York", id: "grace", name: "Grace Hopper", orders: 5 },
  { city: "Manchester", id: "alan", name: "Alan Turing", orders: 2 },
  { city: "Helsinki", id: "linus", name: "Linus Torvalds", orders: 7 },
  { city: "Boston", id: "margaret", name: "Margaret Hamilton", orders: 1 },
  { city: "Murray Hill", id: "ken", name: "Ken Thompson", orders: 4 },
  { city: "Los Angeles", id: "barbara", name: "Barbara Liskov", orders: 2 },
];

export const itemColumns: readonly Column[] = [
  { key: "name", label: "Item" },
  { format: String, key: "quantity", label: "Qty" },
  { format: money, key: "price", label: "Price" },
];

/** An order's line items, made up from its total. */
export const itemsOf = (order: Row): readonly Row[] => {
  const total = Number(order.total);
  const keyboard = Math.round(total * 0.5);
  const cable = Math.round(total * 0.15);
  return [
    { id: "keyboard", name: "Keyboard", price: keyboard, quantity: 1 },
    { id: "cable", name: "Cable", price: cable, quantity: 2 },
    {
      id: "stand",
      name: "Stand",
      price: total - keyboard - 2 * cable,
      quantity: 1,
    },
  ];
};
