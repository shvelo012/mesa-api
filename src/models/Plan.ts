import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
  BelongsToMany,
} from "sequelize-typescript";
import { Feature } from "./Feature";
import { PlanFeature } from "./PlanFeature";
import { Subscription } from "./Subscription";

export enum PlanSlug {
  FREE_TRIAL = "free_trial",
  PRO = "pro",
  PREMIUM = "premium",
}

@Table({ tableName: "plans" })
export class Plan extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  // free_trial | pro | premium
  @Column({ type: DataType.STRING, unique: true })
  declare slug: string;

  @Column(DataType.STRING)
  declare name: string;

  @Column(DataType.TEXT)
  declare description: string | null;

  // price in cents (0 for free trial)
  @Default(0)
  @Column(DataType.INTEGER)
  declare priceMonthly: number;

  // trial duration in days (null = not a trial)
  @Column(DataType.INTEGER)
  declare trialDays: number | null;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  // display order
  @Default(0)
  @Column(DataType.INTEGER)
  declare sortOrder: number;

  @BelongsToMany(() => Feature, () => PlanFeature)
  declare features: Feature[];

  @HasMany(() => Subscription)
  declare subscriptions: Subscription[];

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
