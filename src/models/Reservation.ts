import {
  Table,
  Column,
  Model,
  DataType,
  BelongsTo,
  ForeignKey,
  PrimaryKey,
  Default,
  AllowNull,
  Unique,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { v4 as uuidv4 } from "uuid";
import { User } from "./User";
import { TableModel } from "./Table";

export enum ReservationStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  SEATED = "SEATED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
  NO_SHOW = "NO_SHOW",
}

@Table({ tableName: "reservations" })
export class Reservation extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column(DataType.DATEONLY)
  declare date: string;

  @Column(DataType.STRING)
  declare startTime: string;

  @Column(DataType.STRING)
  declare endTime: string;

  @Column(DataType.INTEGER)
  declare partySize: number;

  @Default(ReservationStatus.PENDING)
  @Column(DataType.STRING)
  declare status: ReservationStatus;

  @Column(DataType.TEXT)
  declare notes: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare guestName: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare guestEmail: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare guestPhone: string | null;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string | null;

  @BelongsTo(() => User)
  declare user: User;

  @ForeignKey(() => TableModel)
  @Column(DataType.UUID)
  declare tableId: string;

  @BelongsTo(() => TableModel)
  declare table: TableModel;

  @Unique
  @Default(() => uuidv4())
  @Column(DataType.UUID)
  declare confirmationToken: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
