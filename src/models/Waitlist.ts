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
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Restaurant } from "./Restaurant";
import { User } from "./User";

export enum WaitlistStatus {
  WAITING = "WAITING",
  NOTIFIED = "NOTIFIED",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
}

@Table({ tableName: "waitlists" })
export class Waitlist extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Restaurant)
  @Column(DataType.UUID)
  declare restaurantId: string;

  @BelongsTo(() => Restaurant)
  declare restaurant: Restaurant;

  @Column(DataType.DATEONLY)
  declare date: string;

  @Column(DataType.INTEGER)
  declare partySize: number;

  @Column(DataType.STRING)
  declare guestName: string;

  @Column(DataType.STRING)
  declare guestEmail: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare guestPhone: string | null;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string | null;

  @BelongsTo(() => User)
  declare user: User;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare notes: string | null;

  @Default(WaitlistStatus.WAITING)
  @Column(DataType.ENUM(...Object.values(WaitlistStatus)))
  declare status: WaitlistStatus;

  @Default(0)
  @Column(DataType.INTEGER)
  declare position: number;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
