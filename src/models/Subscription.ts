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
} from "sequelize-typescript";
import { Restaurant } from "./Restaurant";
import { Plan } from "./Plan";

export enum SubscriptionStatus {
  TRIALING = "TRIALING",
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

@Table({ tableName: "subscriptions" })
export class Subscription extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Restaurant)
  @Column(DataType.UUID)
  declare restaurantId: string;

  @ForeignKey(() => Plan)
  @Column(DataType.UUID)
  declare planId: string;

  @Default(SubscriptionStatus.TRIALING)
  @Column(DataType.STRING)
  declare status: SubscriptionStatus;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare trialEndsAt: Date | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare currentPeriodEnd: Date | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare cancelledAt: Date | null;

  @BelongsTo(() => Restaurant)
  declare restaurant: Restaurant;

  @BelongsTo(() => Plan)
  declare plan: Plan;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
