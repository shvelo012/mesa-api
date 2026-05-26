import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Plan } from "./Plan";
import { Feature } from "./Feature";

@Table({ tableName: "plan_features" })
export class PlanFeature extends Model {
  @ForeignKey(() => Plan)
  @Column(DataType.UUID)
  declare planId: string;

  @ForeignKey(() => Feature)
  @Column(DataType.UUID)
  declare featureId: string;

  @BelongsTo(() => Plan)
  declare plan: Plan;

  @BelongsTo(() => Feature)
  declare feature: Feature;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
