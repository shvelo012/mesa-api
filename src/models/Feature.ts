import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  BelongsToMany,
} from "sequelize-typescript";
import { Plan } from "./Plan";
import { PlanFeature } from "./PlanFeature";

@Table({ tableName: "features" })
export class Feature extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  // machine-readable key, e.g. "staff_management"
  @Column({ type: DataType.STRING, unique: true })
  declare key: string;

  // human label, e.g. "Staff Management"
  @Column(DataType.STRING)
  declare name: string;

  @Column(DataType.TEXT)
  declare description: string | null;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @BelongsToMany(() => Plan, () => PlanFeature)
  declare plans: Plan[];

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
