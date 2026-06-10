import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  AllowNull,
  Index,
} from "sequelize-typescript";
import { Restaurant } from "./Restaurant";
import { Plan } from "./Plan";
import { Subscription } from "./Subscription";

export enum PaymentProviderKey {
  TBC = "TBC",
  BOG = "BOG",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export enum PaymentKind {
  INITIAL = "INITIAL", // first checkout (hosted redirect, may save card)
  RECURRING = "RECURRING", // automatic renewal charge against a saved card
}

@Table({ tableName: "payments" })
export class Payment extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Restaurant)
  @Column(DataType.UUID)
  declare restaurantId: string;

  @AllowNull(true)
  @ForeignKey(() => Plan)
  @Column(DataType.UUID)
  declare planId: string | null;

  @AllowNull(true)
  @ForeignKey(() => Subscription)
  @Column(DataType.UUID)
  declare subscriptionId: string | null;

  @Column(DataType.STRING)
  declare provider: PaymentProviderKey;

  // Bank-side order/payment id. Set after createOrder; used to match callbacks.
  @AllowNull(true)
  @Index
  @Column(DataType.STRING)
  declare providerOrderId: string | null;

  // Minor units (tetri). 1 GEL = 100 tetri.
  @Column(DataType.INTEGER)
  declare amount: number;

  @Default("GEL")
  @Column(DataType.STRING)
  declare currency: string;

  @Default(PaymentStatus.PENDING)
  @Column(DataType.STRING)
  declare status: PaymentStatus;

  @Default(PaymentKind.INITIAL)
  @Column(DataType.STRING)
  declare kind: PaymentKind;

  // Last raw callback / status payload from the bank — kept for audit/debugging.
  @AllowNull(true)
  @Column(DataType.JSONB)
  declare rawCallback: unknown;

  @BelongsTo(() => Restaurant)
  declare restaurant: Restaurant;

  @BelongsTo(() => Plan)
  declare plan: Plan;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
