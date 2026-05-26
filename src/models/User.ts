import {
  Table as SeqTable,
  Column,
  Model,
  DataType,
  HasMany,
  HasOne,
  PrimaryKey,
  Default,
  Unique,
  CreatedAt,
  UpdatedAt,
  AllowNull,
} from "sequelize-typescript";
import { Restaurant } from "./Restaurant";
import { Reservation } from "./Reservation";
import { Review } from "./Review";

export enum Role {
  USER = "USER",
  RESTAURANT_OWNER = "RESTAURANT_OWNER",
  ADMIN = "ADMIN",
}

@SeqTable({ tableName: "users" })
export class User extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Unique
  @Column(DataType.STRING)
  declare email: string;

  @Column(DataType.STRING)
  declare password: string;

  @Column(DataType.STRING)
  declare name: string;

  @Column(DataType.STRING)
  declare phone: string | null;

  @Default(Role.USER)
  @Column(DataType.STRING)
  declare role: Role;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare emailVerified: boolean;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare emailVerificationToken: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @HasOne(() => Restaurant)
  declare restaurant: Restaurant;

  @HasMany(() => Reservation)
  declare reservations: Reservation[];

  @HasMany(() => Review)
  declare reviews: Review[];
}
