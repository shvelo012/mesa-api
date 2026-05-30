import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  ForeignKey,
  AllowNull,
  CreatedAt,
} from "sequelize-typescript";
import { User } from "./User";

@Table({ tableName: "audit_logs", updatedAt: false })
export class AuditLog extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string | null;

  @Column(DataType.STRING)
  declare action: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare resourceType: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare resourceId: string | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare metadata: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare ip: string | null;

  @CreatedAt
  declare createdAt: Date;
}
