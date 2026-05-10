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
} from "sequelize-typescript";
import { Restaurant } from "./Restaurant";
import { Reservation } from "./Reservation";

export enum Role {
  USER = "USER",
  RESTAURANT_OWNER = "RESTAURANT_OWNER",
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
  @Column(DataType.ENUM(...Object.values(Role)))
  declare role: Role;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @HasOne(() => Restaurant)
  declare restaurant: Restaurant;

  @HasMany(() => Reservation)
  declare reservations: Reservation[];
}
